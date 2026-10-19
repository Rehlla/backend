import { AsyncLocalStorage } from 'async_hooks';

/**
 * Structured JSON-line logger.
 *
 * Console.log on Cloud Run / PaaS is collected as plain text, which makes
 * grepping a single request across modules painful. Every line here is a JSON
 * object with level, timestamp, module, and an optional correlationId, so logs
 * can be filtered and correlated (`correlationId: "..."`) end to end.
 *
 * `withCorrelation` runs a request handler inside an AsyncLocalStorage context;
 * any log call inside it picks up the correlationId automatically.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const correlationStorage = new AsyncLocalStorage<string | undefined>();

export function withCorrelation<T>(correlationId: string | undefined, fn: () => T): T {
  return correlationStorage.run(correlationId, fn);
}

function emit(level: LogLevel, module: string, message: string, fields?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[configuredLevel]) return;
  const line = {
    level,
    timestamp: new Date().toISOString(),
    module,
    message,
    correlationId: correlationStorage.getStore() || fields?.correlationId,
    ...fields
  };
  const text = JSON.stringify(line);
  if (level === 'error') console.error(text);
  else if (level === 'warn') console.warn(text);
  else console.log(text);
}

export const log = {
  debug: (module: string, message: string, fields?: Record<string, unknown>) => emit('debug', module, message, fields),
  info: (module: string, message: string, fields?: Record<string, unknown>) => emit('info', module, message, fields),
  warn: (module: string, message: string, fields?: Record<string, unknown>) => emit('warn', module, message, fields),
  error: (module: string, message: string, fields?: Record<string, unknown>) => emit('error', module, message, fields)
};