import { SupportService } from '../services/domain/SupportService';
import { DayGiDomainService } from '../services/domain/DayGiDomainService';
import { AccommodationQueryService } from '../services/domain/AccommodationQueryService';
import { db } from '../db/database';
import { ledgerService } from '../services/ledgerService';

/**
 * Mounted per request by the transport adapter. The actor is resolved from the
 * session by the Express handler — resolvers never read identity from a
 * payload, which is the same rule the REST routes enforce after the IDOR
 * fixes documented in server.ts.
 */
export interface GraphQLContext {
  actor: { userId: string; role: string } | null;
  correlationId?: string;
}

function requireActor(ctx: GraphQLContext): { userId: string; role: string } {
  if (!ctx.actor) {
    // Defence in depth: the deny-by-default /api policy already answers
    // anonymous requests with 401 before a resolver can run. If a future
    // transport forgets that gate, this still refuses.
    throw new Error('Authentication required.');
  }
  return ctx.actor;
}

/**
 * Resolvers ride as the GraphQL rootValue: graphql-js' default field
 * resolver invokes function-valued properties with (args, context, info), so
 * nested type resolvers (the DayGi fields below) are plain function
 * properties on the object the parent resolver returns. No resolver mapping
 * library involved — see schema.ts for why there is exactly one `graphql`
 * instance in the chain.
 */

const daygiFields = {
  // The caller's structured memory, auto-created on first read.
  memory: (_args: unknown, ctx: GraphQLContext) =>
    DayGiDomainService.getMemory(requireActor(ctx).userId),

  // tripId is required at the SDL layer; the domain service still guards.
  tasks: (args: { tripId: string }, ctx: GraphQLContext) =>
    DayGiDomainService.getTasks(requireActor(ctx).userId, args.tripId),

  // Null for BOTH a missing task and somebody else's task — the REST route's
  // flat-404 semantics, so the field never confirms a task exists.
  task: (args: { taskId: string }, ctx: GraphQLContext) =>
    DayGiDomainService.getTaskForActor(args.taskId, requireActor(ctx))
};

export const rootValue = {
  /**
   * A traveler sees only their own thread; Operations and Admin see the
   * queue — SupportService.getMessages applies the exact REST rule.
   */
  support: (_args: unknown, ctx: GraphQLContext) =>
    SupportService.getMessages(requireActor(ctx)),

  daygi: () => daygiFields,

  /**
   * Public pre-signup browsing (slice 2): the same card projection as
   * GET /api/accommodations?view=card — no actor required, mirroring the
   * REST policy's public catalogue reads. Validation (including enum members)
   * happens in AccommodationQueryService, so invalid filters surface as field
   * errors exactly like REST's 400s.
   */
  accommodationCards: (args: { filters?: unknown }) =>
    AccommodationQueryService.cardSearch(args?.filters),

  /** Neighborhood guide, public like the REST areas payload. */
  areas: () => AccommodationQueryService.areas(),

  /** A property's sellable room types; null for an unknown slug. */
  roomTypes: (args: { slug: string }) => AccommodationQueryService.roomTypes(args.slug),

  /**
   * Stateless stay quote — the same validation ladder as the REST route;
   * invalid input surfaces as field errors carrying the same messages.
   */
  stayQuote: (args: { slug: string; input: unknown }) =>
    AccommodationQueryService.stayQuote(args.slug, args.input),

  platform: () => {
    const integrity = ledgerService.verifyLedgerIntegrity();
    return {
      status: 'ok',
      service: 'Dahab AI Product & Commercial Platform',
      adapter: db.getAdapter().constructor.name,
      ledgerBalanced: integrity.balanced,
      ledgerChainIntact: integrity.chainIntact,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Same validation, audit and staff-event path as
   * POST /api/support/messages. Identity is the session actor's.
   */
  supportCreateMessage: (args: { input: Record<string, unknown> }, ctx: GraphQLContext) =>
    SupportService.createMessage(requireActor(ctx), args.input, ctx.correlationId)
};
