import { db } from '../db/database';
import type { IntegrationConfigEntity } from '../db/schema';
import { getConfig } from '../config';
import { auditService } from './auditService';
import { firebaseAdminService } from './firebaseAdminService';

/**
 * Real health probes for the external integrations
 * (GET /api/admin/integrations, docs/OPS_API_CONTRACT.md).
 *
 * Each probe is a cheap authenticated read against the provider with a
 * timeout. A provider whose key is absent reports 'unconfigured' WITHOUT any
 * network call; an admin-disabled one reports 'disabled'. Results are cached
 * (INTEGRATION_PROBE_CACHE_MS, default 60 s) so dashboards polling this do
 * not turn into a load test on Paymob. fetch and the clock are injectable so
 * tests never touch the network.
 */

export type IntegrationStatus = 'healthy' | 'degraded' | 'down' | 'disabled' | 'unconfigured';

export interface IntegrationHealth {
  id: string;
  name: string;
  status: IntegrationStatus;
  latencyMs: number | null;
  checkedAt: string;
  mode: 'sandbox' | 'live';
  enabled: boolean;
  keyHint: string | null;
  detail: string;
}

type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean }>;

interface ProbeDef {
  id: string;
  name: string;
  purpose: string;
  key: (env: ReturnType<typeof getConfig>) => string | undefined;
  probe: (ctx: ProbeContext) => Promise<{ status: IntegrationStatus; detail: string }>;
}

interface ProbeContext {
  env: ReturnType<typeof getConfig>;
  fetch: FetchLike;
  timeoutMs: number;
  firebaseCheck: () => Promise<boolean>;
}

function classify(httpStatus: number, okDetail: string): { status: IntegrationStatus; detail: string } {
  if (httpStatus >= 200 && httpStatus < 300) return { status: 'healthy', detail: okDetail };
  if (httpStatus === 401 || httpStatus === 403) return { status: 'down', detail: `credentials rejected (HTTP ${httpStatus})` };
  if (httpStatus === 429) return { status: 'degraded', detail: 'rate limited (HTTP 429)' };
  if (httpStatus >= 500) return { status: 'down', detail: `provider error (HTTP ${httpStatus})` };
  return { status: 'degraded', detail: `unexpected HTTP ${httpStatus}` };
}

async function timed(ctx: ProbeContext, url: string, init: Parameters<FetchLike>[1] = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ctx.timeoutMs);
  try {
    return await ctx.fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const PROBES: readonly ProbeDef[] = [
  {
    id: 'paymob', name: 'Paymob', purpose: 'Payment processing',
    key: env => env.PAYMOB_API_KEY,
    probe: async ctx => {
      const res = await timed(ctx, 'https://accept.paymob.com/api/auth/tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: ctx.env.PAYMOB_API_KEY }),
      });
      const out = classify(res.status, 'auth token issued');
      if (out.status === 'healthy' && !ctx.env.PAYMOB_HMAC_SECRET) return { status: 'degraded', detail: 'API reachable, but PAYMOB_HMAC_SECRET is unset so webhooks are rejected' };
      return out;
    },
  },
  {
    id: 'twilio', name: 'Twilio SMS', purpose: 'SMS gateway',
    key: env => (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN ? env.TWILIO_AUTH_TOKEN : undefined),
    probe: async ctx => {
      const sid = ctx.env.TWILIO_ACCOUNT_SID!;
      const auth = Buffer.from(`${sid}:${ctx.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const res = await timed(ctx, `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, { headers: { Authorization: `Basic ${auth}` } });
      return classify(res.status, 'account reachable');
    },
  },
  {
    id: 'locationiq', name: 'LocationIQ', purpose: 'Reverse geocoding',
    key: env => env.LOCATIONIQ_API_KEY,
    probe: async ctx => {
      const res = await timed(ctx, `https://us1.locationiq.com/v1/balance?key=${encodeURIComponent(ctx.env.LOCATIONIQ_API_KEY!)}&format=json`);
      return classify(res.status, 'balance endpoint reachable');
    },
  },
  {
    id: 'ai', name: 'AI Provider (OpenAI)', purpose: 'AI reasoning & intelligence',
    key: env => env.OPENAI_API_KEY,
    probe: async ctx => {
      const res = await timed(ctx, 'https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${ctx.env.OPENAI_API_KEY}` } });
      return classify(res.status, `model ${ctx.env.OPENAI_MODEL} available`);
    },
  },
  {
    id: 'firebase', name: 'Firebase Auth', purpose: 'Federated sign-in',
    key: env => env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_PROJECT_ID,
    probe: async ctx => {
      const ok = await Promise.race([
        ctx.firebaseCheck(),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), ctx.timeoutMs)),
      ]);
      return ok ? { status: 'healthy', detail: 'credentials resolve' } : { status: 'down', detail: 'credentials do not resolve; Google sign-in returns 503' };
    },
  },
];

function keyHint(key: string | undefined): string | null {
  if (!key) return null;
  return `••••${key.slice(-4)}`;
}

function configFor(id: string, env: ReturnType<typeof getConfig>): IntegrationConfigEntity {
  const row = db.integrationConfigs.find(c => c.id === id);
  if (row) return row;
  return { id, enabled: true, mode: env.isProduction ? 'live' : 'sandbox', updatedBy: 'SYSTEM', updatedAt: new Date(0).toISOString() };
}

export function createIntegrationHealthService(deps: {
  fetch?: FetchLike;
  now?: () => number;
  env?: () => ReturnType<typeof getConfig>;
  firebaseCheck?: () => Promise<boolean>;
} = {}) {
  const cache = new Map<string, { at: number; result: IntegrationHealth }>();
  const now = deps.now || (() => Date.now());
  const envOf = deps.env || (() => getConfig());
  const fetchImpl: FetchLike = deps.fetch || ((url, init) => fetch(url, init as RequestInit));
  const firebaseCheck = deps.firebaseCheck || (() => firebaseAdminService.verifyConfiguration());

  async function probeOne(def: ProbeDef, force = false): Promise<IntegrationHealth> {
    const env = envOf();
    const cfg = configFor(def.id, env);
    const t = now();
    const hit = cache.get(def.id);
    if (!force && hit && t - hit.at < env.INTEGRATION_PROBE_CACHE_MS && hit.result.enabled === cfg.enabled && hit.result.mode === cfg.mode) {
      return hit.result;
    }
    const key = def.key(env);
    const base = { id: def.id, name: def.name, mode: cfg.mode, enabled: cfg.enabled, keyHint: keyHint(key) };
    let result: IntegrationHealth;
    if (!cfg.enabled) {
      result = { ...base, status: 'disabled', latencyMs: null, checkedAt: new Date(t).toISOString(), detail: 'disabled by an admin' };
    } else if (!key) {
      result = { ...base, status: 'unconfigured', latencyMs: null, checkedAt: new Date(t).toISOString(), detail: 'credentials not set' };
    } else {
      const start = now();
      try {
        const out = await def.probe({ env, fetch: fetchImpl, timeoutMs: env.INTEGRATION_PROBE_TIMEOUT_MS, firebaseCheck });
        result = { ...base, ...out, latencyMs: Math.max(0, now() - start), checkedAt: new Date(now()).toISOString() };
      } catch (err: any) {
        const aborted = err?.name === 'AbortError';
        result = { ...base, status: 'down', latencyMs: Math.max(0, now() - start), checkedAt: new Date(now()).toISOString(), detail: aborted ? 'probe timed out' : `network error: ${err?.message || err}` };
      }
    }
    cache.set(def.id, { at: t, result });
    return result;
  }

  return {
    async list(): Promise<IntegrationHealth[]> {
      return Promise.all(PROBES.map(p => probeOne(p)));
    },
    async check(id: string): Promise<IntegrationHealth> {
      const def = PROBES.find(p => p.id === id);
      if (!def) throw Object.assign(new Error('Integration not found.'), { status: 404 });
      return probeOne(def, true);
    },
    update(id: string, patch: { enabled?: boolean; mode?: 'sandbox' | 'live' }, actor: { userId: string; role: string }, reason: string, correlationId?: string) {
      if (!PROBES.some(p => p.id === id)) throw Object.assign(new Error('Integration not found.'), { status: 404 });
      if (patch.mode !== undefined && patch.mode !== 'sandbox' && patch.mode !== 'live') throw Object.assign(new Error('mode must be sandbox or live.'), { status: 400 });
      const env = envOf();
      const before = { ...configFor(id, env) };
      let row = db.integrationConfigs.find(c => c.id === id);
      db.runInTransaction(() => {
        if (!row) {
          row = { ...before };
          db.integrationConfigs.push(row);
        }
        if (patch.enabled !== undefined) row.enabled = patch.enabled;
        if (patch.mode !== undefined) row.mode = patch.mode;
        row.updatedBy = actor.userId;
        row.updatedAt = new Date().toISOString();
      });
      cache.delete(id);
      auditService.record({ actor: actor.userId, actorRole: actor.role, action: 'INTEGRATION_UPDATED', entityType: 'Integration', entityId: id, before, after: { ...row }, reason, correlationId });
      return row!;
    },
    /** Legacy shape for the web SystemHealth panel (GET /api/operations/integrations). */
    async legacyList() {
      const items = await this.list();
      return items.map(i => {
        const def = PROBES.find(p => p.id === i.id)!;
        const ok = i.status === 'healthy';
        return {
          name: i.name,
          purpose: def.purpose,
          status: ok ? 'healthy' : i.status === 'down' ? 'down' : 'degraded',
          lastSuccess: ok ? i.checkedAt : null,
          lastFailure: ok ? null : i.checkedAt,
          freshness: ok ? (i.mode === 'live' ? 'live' : 'sandbox') : i.status,
          detail: i.detail,
        };
      });
    },
    clearCache() {
      cache.clear();
    },
  };
}

export type IntegrationHealthService = ReturnType<typeof createIntegrationHealthService>;
export const integrationHealthService = createIntegrationHealthService();
