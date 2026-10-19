import { z } from 'zod';

/**
 * Typed environment for the server (names and meanings: .env.example).
 *
 * Read lazily: dotenv.config() runs in server.ts AFTER every module body has
 * executed, and tests set process.env at runtime, so a value captured at
 * import time would be wrong in both. getConfig() parses on each call (it is
 * a few dozen string reads) and never throws: an unparsable optional value
 * falls back to its default, exactly as the ad-hoc process.env reads did.
 */

const str = () => z.string().optional().transform(v => (v && v.trim() ? v.trim() : undefined));
const bool = (dflt: boolean) =>
  z.string().optional().transform(v => (v === undefined || v === '' ? dflt : v.toLowerCase() === 'true'));
const int = (dflt: number) =>
  z.string().optional().transform(v => {
    const n = Number(v);
    return v !== undefined && v !== '' && Number.isFinite(n) ? n : dflt;
  });

const EnvSchema = z.object({
  NODE_ENV: z.string().optional().transform(v => v || 'development'),
  PORT: int(3000),
  APP_URL: str(),
  PUBLIC_BASE_URL: str(),
  PERSISTENCE_ADAPTER: z.string().optional().transform(v => (v === 'json' || v === 'postgres' ? v : 'sqlite')),
  DATABASE_URL: str(),
  DAHAB_DATA_DIR: str(),
  DAHAB_SEED_DIR: str(),
  SEED_USER_PASSWORD: str(),
  ENABLE_TEST_ENDPOINTS: bool(false),
  ALLOW_SIMULATED_PAYMENTS: bool(false),
  DISABLE_HMR: bool(false),
  LOG_LEVEL: str(),
  // AI
  OPENAI_API_KEY: str(),
  OPENAI_MODEL: z.string().optional().transform(v => v || 'gpt-4o-mini'),
  AI_POLISH_TIMEOUT_MS: int(6000),
  SKIP_AI_POLISH: bool(false),
  // Payments
  PAYMOB_API_KEY: str(),
  PAYMOB_HMAC_SECRET: str(),
  // SMS
  TWILIO_ACCOUNT_SID: str(),
  TWILIO_AUTH_TOKEN: str(),
  TWILIO_PHONE_NUMBER: str(),
  // Geo
  LOCATIONIQ_API_KEY: str(),
  // Firebase
  FIREBASE_PROJECT_ID: str(),
  FIREBASE_SERVICE_ACCOUNT_JSON: str(),
  // Web push
  VAPID_PUBLIC_KEY: str(),
  VAPID_PRIVATE_KEY: str(),
  VAPID_SUBJECT: str(),
  // Native auth (docs/OPS_API_CONTRACT.md)
  ACCESS_TOKEN_TTL_MINUTES: int(15),
  REFRESH_TOKEN_TTL_DAYS: int(30),
  // Integration probes
  INTEGRATION_PROBE_TIMEOUT_MS: int(4000),
  INTEGRATION_PROBE_CACHE_MS: int(60_000),
});

export type ServerConfig = z.output<typeof EnvSchema> & { isProduction: boolean };

export function getConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = EnvSchema.safeParse(env);
  // safeParse cannot fail on these transforms (all optional strings), but a
  // non-string injected into process.env must still never crash a request.
  const data = parsed.success ? parsed.data : EnvSchema.parse({});
  return { ...data, isProduction: data.NODE_ENV === 'production' };
}
