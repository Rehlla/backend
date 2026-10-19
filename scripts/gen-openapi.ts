/**
 * Generates openapi.json (repo root) from the zod schemas in
 * server/contracts/opsContract.ts.
 *
 *   npm run openapi:gen
 *
 * OPS_ENDPOINTS is the machine contract; docs/OPS_API_CONTRACT.md is the
 * human one. Both describe the same endpoints. Re-run this after any change
 * to opsContract.ts and commit the result, so the Flutter client can be
 * generated from a file that matches the server.
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

async function main() {
  const contract = await import('../server/contracts/opsContract');
  const catalog = await import('../server/contracts/catalogContract');
  const { Problem } = contract;
  // docs/CATALOG_API_CONTRACT.md rides in the same document.
  const OPS_ENDPOINTS = [...contract.OPS_ENDPOINTS, ...catalog.CATALOG_ENDPOINTS];

  const registry = new OpenAPIRegistry();

  // Named components, referenced by $ref wherever the same schema instance appears.
  const named: Record<string, z.ZodTypeAny> = {
    Problem: contract.Problem,
    User: contract.User,
    Session: contract.Session,
    Device: contract.Device,
    Override: contract.Override,
    AuditEvent: contract.AuditEvent,
    Approval: contract.Approval,
    SettingItem: contract.SettingItem,
    FlagItem: contract.FlagItem,
    RemoteConfigResponse: contract.RemoteConfigResponse,
    AppGate: contract.AppGate,    IntegrationItem: contract.IntegrationItem,
    RoleItem: contract.RoleItem,
    PermissionItem: contract.PermissionItem,
    SearchItem: contract.SearchItem,
    StreamEventData: contract.StreamEventData,
    CatalogEnvelope: catalog.CatalogEnvelope,
    CatalogTypeSchema: catalog.CatalogTypeSchema,
  };
  for (const [name, schema] of Object.entries(named)) registry.register(name, schema);

  registry.registerComponent('securitySchemes', 'bearer', {
    type: 'http',
    scheme: 'bearer',
    description: 'Native clients: Authorization: Bearer <accessToken> plus X-Dahab-Client: native.',
  });
  registry.registerComponent('securitySchemes', 'cookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'dahab_auth_token',
    description: 'Website: HttpOnly session cookie.',
  });

  const problem = (description: string) => ({ description, content: { 'application/problem+json': { schema: Problem } } });

  for (const ep of OPS_ENDPOINTS) {
    const paramNames = [...ep.path.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    const params = paramNames.length
      ? z.object(Object.fromEntries(paramNames.map(n => [n, z.string()])))
      : undefined;

    const headers: z.ZodTypeAny[] = [];
    const headerShape: Record<string, z.ZodTypeAny> = {};
    if (ep.idempotent) headerShape['Idempotency-Key'] = z.string().max(200).optional();
    if (ep.ifMatch) headerShape['If-Match'] = z.string().max(64).optional();
    if (Object.keys(headerShape).length) headers.push(z.object(headerShape));

    const okContent = ep.responseContentType
      ? { [ep.responseContentType]: { schema: z.string() } }
      : ep.response
        ? { 'application/json': { schema: ep.response } }
        : { 'application/json': { schema: z.record(z.string(), z.unknown()) } };

    const descParts = [ep.summary];
    if (ep.permission) descParts.push(`Requires permission \`${ep.permission}\`.`);
    if (ep.idempotent) descParts.push('Accepts `Idempotency-Key`; a replay returns the first response with `Idempotent-Replay: true`.');
    if (ep.ifMatch) descParts.push('Send `If-Match: <updatedAt>`; a stale value answers 409 `.../stale`.');

    registry.registerPath({
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      description: descParts.join(' '),
      tags: [ep.tag],
      security: ep.public ? [] : [{ bearer: [] }, { cookie: [] }],
      request: {
        ...(params ? { params } : {}),
        ...(ep.query ? { query: ep.query } : {}),
        ...(headers.length ? { headers: headers[0] as z.ZodObject<any> } : {}),
        ...(ep.body ? { body: { content: { 'application/json': { schema: ep.body } } } } : {}),
      },
      responses: {
        [ep.okStatus ?? (ep.method === 'post' && /\/(users|roles|devices)$/.test(ep.path) ? 201 : 200)]: { description: 'OK', content: okContent },
        ...(ep.tag === 'catalog' || ep.tag === 'supplier-catalog'
          ? {
              202: { description: 'Supplier change queued for staff review (body carries approvalId)', content: okContent },
              404: problem('Not found (or not yours)'),
              409: problem('stale (If-Match), in-use, invalid-transition or conflict'),
              422: problem('incomplete: body carries missing[]'),
            }
          : {}),
        ...(ep.method === 'get' && (ep.path === '/api/operations/overview' || ep.path === '/api/config') ? { 304: { description: 'Not modified (If-None-Match matched the ETag)' } } : {}),
        400: problem('Validation failed'),
        ...(ep.public ? {} : { 401: problem('Authentication required') }),
        ...(ep.public ? {} : { 403: problem('Forbidden, approval-required (body carries approvalId) or view-as-readonly') }),
        503: problem('Kill switch or maintenance'),
      },
    });
  }

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Dahab Ops API',
      version: '1.0.0',
      description: 'Staff dashboard API (web + dahab-ops Flutter). Human contract: docs/OPS_API_CONTRACT.md.',
    },
    servers: [{ url: '/' }],
  });

  const out = path.join(process.cwd(), 'openapi.json');
  fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
  console.log(`${out}`);
  console.log(`  ${Object.keys(doc.paths || {}).length} paths · ${OPS_ENDPOINTS.length} operations · ${Object.keys(doc.components?.schemas || {}).length} schemas`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
