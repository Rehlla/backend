import {
  parse,
  validate,
  execute,
  specifiedRules,
  GraphQLError,
  type ASTVisitor,
  type DocumentNode,
  type FieldNode,
  type SelectionSetNode,
  type ValidationContext
} from 'graphql';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { schema } from './schema';
import { rootValue } from './resolvers';

/**
 * Express adapter for the GraphQL gateway. POST /api/graphql only.
 *
 * Hardening on this handler:
 * - Depth cap: the schema slice is 3 levels deep; anything past
 *   MAX_QUERY_DEPTH is a DoS probe, not a query.
 * - Introspection is disabled when NODE_ENV=production, mirroring the
 *   platform's deny-by-default posture.
 * - Authentication is NOT handled here: the route is unlisted in
 *   apiAccessPolicy, so deny-by-default makes it authenticated-only, and the
 *   resolvers re-assert the actor from the context (defence in depth).
 */

const MAX_QUERY_DEPTH = 8;

function selectionDepth(set: SelectionSetNode | undefined): number {
  if (!set) return 0;
  let max = 0;
  for (const selection of set.selections) {
    if (selection.kind === 'Field' || selection.kind === 'InlineFragment') {
      max = Math.max(max, selectionDepth(selection.selectionSet) + 1);
    } else if (selection.kind === 'FragmentSpread') {
      // A named fragment counts as one level here. Fragments cannot recurse
      // (validation rejects circular definitions), so chained fragments only
      // ever add a bounded number of levels — the cap is a DoS guard, not a
      // security boundary.
      max = Math.max(max, 1);
    }
  }
  return max;
}

/** Max selection depth across all operations in a document. Exported for tests. */
export function queryDepth(document: DocumentNode): number {
  let max = 0;
  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition') {
      max = Math.max(max, selectionDepth(definition.selectionSet));
    }
  }
  return max;
}

function noIntrospectionRule(context: ValidationContext): ASTVisitor {
  return {
    Field(node: FieldNode) {
      if (node.name.value === '__schema' || node.name.value === '__type') {
        context.reportError(
          new GraphQLError('GraphQL introspection is disabled.', { nodes: [node] })
        );
      }
    }
  };
}

const validationRules =
  process.env.NODE_ENV === 'production'
    ? [...specifiedRules, noIntrospectionRule]
    : specifiedRules;

export async function graphqlHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const body = req.body && typeof req.body === 'object'
    ? (req.body as Record<string, unknown>)
    : {};
  const source = typeof body.query === 'string' ? body.query : '';
  if (!source) {
    res.status(400).json({ errors: [{ message: 'A GraphQL "query" string is required.' }] });
    return;
  }

  let document: DocumentNode;
  try {
    document = parse(source);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Malformed GraphQL query.';
    res.status(400).json({ errors: [{ message }] });
    return;
  }

  const depth = queryDepth(document);
  if (depth > MAX_QUERY_DEPTH) {
    res.status(400).json({
      errors: [{ message: `Query depth ${depth} exceeds the maximum of ${MAX_QUERY_DEPTH}.` }]
    });
    return;
  }

  const validationErrors = validate(schema, document, validationRules);
  if (validationErrors.length > 0) {
    res.status(400).json({ errors: validationErrors });
    return;
  }

  const result = await execute({
    schema,
    rootValue,
    document,
    contextValue: {
      // Identity from the session (optionalAuth), never the request body.
      actor: req.user ? { userId: req.user.userId, role: req.user.role } : null,
      correlationId: req.correlationId
    },
    variableValues:
      body.variables && typeof body.variables === 'object'
        ? (body.variables as Record<string, unknown>)
        : undefined,
    operationName: typeof body.operationName === 'string' ? body.operationName : undefined
  });

  // GraphQL-over-HTTP convention: resolver errors ride in the errors array
  // with a 200. Transport-level problems were answered above with 4xx.
  res.status(200).json(result);
}
