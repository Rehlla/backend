import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { authService } from '../services/authService';
import { SupportService } from '../services/domain/SupportService';
import { DayGiDomainService } from '../services/domain/DayGiDomainService';
import { AccommodationQueryService } from '../services/domain/AccommodationQueryService';
import { db } from '../db/database';
import { ledgerService } from '../services/ledgerService';
import type { DayGiOrchestratedTask } from '../../src/shared';

/**
 * gRPC gateway — slice 1.
 *
 * Transport adapter only: every rpc resolves through the same domain
 * services as REST and GraphQL, so ownership and validation rules cannot
 * drift between protocols.
 *
 * Identity: "authorization: Bearer <session token>" gRPC metadata, validated
 * by authService.validateToken — the exact function the Express middlewares
 * use, including suspension and device-revocation checks. A caller-supplied
 * user id is never honoured; no token means UNAUTHENTICATED (deny-by-default,
 * like the /api policy).
 */

const PROTO_OPTIONS: protoLoader.Options = {
  // snake_case proto fields surface as camelCase in TypeScript, matching the
  // domain entities, so handlers pass domain objects straight through.
  keepCase: false,
  defaults: true,
  oneofs: true
};

/**
 * The .proto lives on disk (not a TS string) so tooling that speaks proto —
 * flutter packages, buf, postman — can consume it directly. Resolution order:
 *  1. the source tree (tsx dev / tsx server.ts)
 *  2. dist/grpc/protos (the esbuild bundle; the build script copies it)
 */
function resolveProtoPath(): string {
  // vite-node/vitest may not provide __dirname for transformed sources; the
  // cwd candidate keeps resolution working there.
  const here = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const candidates = [
    path.resolve(here, 'protos', 'dahab.proto'),                     // tsx dev: server/grpc/protos
    path.resolve(here, 'server', 'grpc', 'protos', 'dahab.proto'),   // vitest: resolved from the repo root
    path.resolve(here, 'grpc', 'protos', 'dahab.proto')              // dist/server.cjs: build copies it
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`dahab.proto not found (looked in: ${candidates.join(', ')})`);
  }
  return found;
}

/**
 * Loads and returns the dahab.v1 package. Exported so tests (and any future
 * internal client) build against exactly the definition the server serves —
 * one source of truth, like the GraphQL schema export. Untyped by design:
 * loadPackageDefinition is a dynamic schema surface, pinned by the tests.
 */
export function loadDahabGrpcPackage(): { dahab: { v1: { DahabService: any } } } {
  const packageDefinition = protoLoader.loadSync(resolveProtoPath(), PROTO_OPTIONS);
  return grpc.loadPackageDefinition(packageDefinition) as any;
}

type Actor = { userId: string; role: string };

interface GrpcServiceError {
  code: grpc.status;
  message: string;
}

function notFound(message: string): GrpcServiceError {
  return { code: grpc.status.NOT_FOUND, message };
}

function invalidArgument(message: string): GrpcServiceError {
  return { code: grpc.status.INVALID_ARGUMENT, message };
}

/**
 * Resolves the actor from the call's authorization metadata, or answers
 * UNAUTHENTICATED. The error codes mirror the REST surface: 400 →
 * INVALID_ARGUMENT, 404 → NOT_FOUND.
 */
function requireActor(call: grpc.ServerUnaryCall<any, any>): Actor | GrpcServiceError {
  const raw = call.metadata.get('authorization');
  const header = raw.length > 0 && typeof raw[0] === 'string' ? raw[0] : '';
  const authResult = authService.validateToken(header, undefined);
  if (!authResult) {
    return { code: grpc.status.UNAUTHENTICATED, message: 'A valid Bearer session token is required.' };
  }
  return { userId: authResult.user.id, role: String(authResult.user.role) };
}

function isActor(value: Actor | GrpcServiceError): value is Actor {
  return (value as Actor).userId !== undefined;
}

/**
 * The sanitized task projection — identical to the GraphQL one: step
 * actionToken / idempotencyKey / payload / resultData never cross a
 * transport boundary; step execution stays on REST.
 */
function toTaskProto(task: DayGiOrchestratedTask) {
  return {
    taskId: task.taskId,
    userId: task.userId,
    tripId: task.tripId,
    intent: task.intent,
    titleEn: task.titleEn,
    titleAr: task.titleAr,
    currentStepNumber: task.currentStepNumber,
    totalSteps: task.totalSteps,
    riskLevel: task.riskLevel,
    state: task.state,
    steps: (task.steps || []).map((s) => ({
      stepId: s.stepId,
      stepNumber: s.stepNumber,
      name: s.name,
      nameAr: s.nameAr,
      state: s.state,
      riskLevel: s.riskLevel,
      error: s.error
    }))
  };
}

function platformHealth() {
  const integrity = ledgerService.verifyLedgerIntegrity();
  return {
    status: 'ok',
    service: 'Dahab AI Product & Commercial Platform',
    adapter: db.getAdapter().constructor.name,
    ledgerBalanced: integrity.balanced,
    ledgerChainIntact: integrity.chainIntact,
    timestamp: new Date().toISOString()
  };
}

/**
 * The card projection carries the entity casing (perNightEGP), while the
 * proto-loader surfaces snake_case proto fields as camelCase (perNightEgp).
 * This maps the four EGP fields onto the wire names; every other field
 * already matches. proto3 zero-values mean "unset" on the way in — the
 * domain service owns all validation (enums, types) for the three transports.
 */
function toCardProto(card: Record<string, unknown>) {
  return {
    ...card,
    perNightEgp: card.perNightEGP,
    weeklyRateEgp: card.weeklyRateEGP,
    monthlyRateEgp: card.monthlyRateEGP,
    packageTotalEgp: card.packageTotalEGP
  };
}

/** Same casing bridge for the quote: EGP-suffixed fields + night charge lines. */
function toQuoteProto(quote: Record<string, unknown>) {
  return {
    ...quote,
    baseEgp: quote.baseEGP,
    longStayDiscountEgp: quote.longStayDiscountEGP,
    serviceFeeEgp: quote.serviceFeeEGP,
    taxEgp: quote.taxEGP,
    totalEgp: quote.totalEGP,
    depositEgp: quote.depositEGP,
    balanceDueEgp: quote.balanceDueEGP,
    nightsDetail: Array.isArray(quote.nightsDetail)
      ? (quote.nightsDetail as Record<string, unknown>[]).map((n) => ({
          ...n,
          nightlyEgp: n.nightlyEGP,
          totalEgp: n.totalEGP
        }))
      : undefined
  };
}

/** Error mapping for the stays rpcs, mirroring the REST catch's `err?.status ?? 400`. */
function staysErrorToGrpc(err: unknown): GrpcServiceError {
  const status = (err as { status?: number })?.status;
  const message = (err as Error)?.message ?? 'Invalid request.';
  if (status === 404) return notFound(message);
  if (status === 409) return { code: grpc.status.FAILED_PRECONDITION, message };
  // REST treats a missing status as 400 for this surface — mirror it.
  return invalidArgument(message);
}

/**
 * Starts the gateway. Resolves null (and logs) when the port is busy instead
 * of throwing: dev and E2E instances race for the default port, and a second
 * instance must boot HTTP-only rather than crash — the same one-writer
 * posture SQLite already follows.
 */
export function startGrpcServer(
  port: number,
  host = '0.0.0.0'
): Promise<{ endpoint: string; shutdown: () => Promise<void> } | null> {
  const pkg = loadDahabGrpcPackage();
  const server = new grpc.Server();

  server.addService(pkg.dahab.v1.DahabService.service, {
    GetSupportThread: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const actor = requireActor(call);
      if (!isActor(actor)) return callback(actor);
      try {
        const { messages, openCount } = SupportService.getMessages(actor);
        callback(null, { messages, openCount });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err?.message ?? 'Internal error' });
      }
    },

    CreateSupportMessage: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const actor = requireActor(call);
      if (!isActor(actor)) return callback(actor);
      try {
        const message = SupportService.createMessage(actor, call.request, undefined);
        callback(null, message);
      } catch (err: any) {
        callback(
          err?.status === 404
            ? notFound(err.message)
            : invalidArgument(err?.message ?? 'Invalid support message.')
        );
      }
    },

    GetDayGiMemory: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const actor = requireActor(call);
      if (!isActor(actor)) return callback(actor);
      try {
        callback(null, DayGiDomainService.getMemory(actor.userId));
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err?.message ?? 'Internal error' });
      }
    },

    ListDayGiTasks: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const actor = requireActor(call);
      if (!isActor(actor)) return callback(actor);
      const tripId = String(call.request?.tripId ?? '');
      if (!tripId) {
        return callback(invalidArgument('trip_id is required.'));
      }
      try {
        const tasks = DayGiDomainService.getTasks(actor.userId, tripId);
        callback(null, { tasks: tasks.map(toTaskProto) });
      } catch (err: any) {
        callback(
          err?.status === 400
            ? invalidArgument(err.message)
            : { code: grpc.status.INTERNAL, message: err?.message ?? 'Internal error' }
        );
      }
    },

    GetDayGiTask: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const actor = requireActor(call);
      if (!isActor(actor)) return callback(actor);
      const taskId = String(call.request?.taskId ?? '');
      if (!taskId) {
        return callback(invalidArgument('task_id is required.'));
      }
      const task = DayGiDomainService.getTaskForActor(taskId, actor);
      // NOT_FOUND for both a missing task and somebody else's — the rpc
      // never confirms a task exists.
      if (!task) {
        return callback(notFound('Task not found'));
      }
      callback(null, toTaskProto(task));
    },

    GetPlatformHealth: (_call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      // Public like GET /api/health; no session required.
      callback(null, platformHealth());
    },

    // Public like GET /api/accommodations?view=card; no session required.
    // Validation (enum members, types) happens in AccommodationQueryService —
    // the same path REST and GraphQL take.
    ListAccommodationCards: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      try {
        const result = AccommodationQueryService.cardSearch(call.request);
        callback(null, { ...result, cards: result.cards.map(toCardProto) });
      } catch (err: any) {
        callback(
          err?.status === 400
            ? invalidArgument(err.message)
            : { code: grpc.status.INTERNAL, message: err?.message ?? 'Internal error' }
        );
      }
    },

    // Public like the REST areas payload; no session required.
    ListAreas: (_call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      try {
        callback(null, { areas: AccommodationQueryService.areas() });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err?.message ?? 'Internal error' });
      }
    },

    // Public like GET /:slug/room-types; NOT_FOUND for an unknown slug.
    ListRoomTypes: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      const result = AccommodationQueryService.roomTypes(String(call.request?.slug ?? ''));
      if (!result) {
        return callback(notFound('Accommodation not found.'));
      }
      callback(null, {
        accommodationId: result.accommodationId,
        roomTypes: result.roomTypes,
        heldBack: result.heldBack
      });
    },

    // Public like POST /:slug/quote; validation errors map like REST's 400s.
    QuoteStay: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
      try {
        const request = call.request ?? {};
        const quote = AccommodationQueryService.stayQuote(String(request.slug ?? ''), {
          roomTypeId: request.roomTypeId,
          checkIn: request.checkIn,
          checkOut: request.checkOut,
          rooms: request.rooms,
          adults: request.adults,
          children: request.children
        });
        if (!quote) {
          return callback(notFound('Accommodation not found.'));
        }
        callback(null, toQuoteProto(quote as unknown as Record<string, unknown>));
      } catch (err: unknown) {
        callback(staysErrorToGrpc(err));
      }
    }
  });

  const endpoint = `${host}:${port}`;
  return new Promise((resolve) => {
    server.bindAsync(endpoint, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        // code 14 = UNAVAILABLE, the EADDRINUSE equivalent here.
        const reason = (err as { code?: number })?.code === 14 ? 'port busy' : err.message;
        console.log(`[gRPC] not started on ${endpoint} (${reason}) — this instance serves HTTP only.`);
        resolve(null);
        return;
      }
      // bindAsync binds AND starts serving (grpc-js >= 1.10); no start() call.
      resolve({
        endpoint: `${host}:${boundPort}`,
        shutdown: () =>
          new Promise<void>((done) => {
            server.tryShutdown(() => done());
          })
      });
    });
  });
}
