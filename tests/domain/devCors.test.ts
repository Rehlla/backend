import { describe, expect, it, vi } from 'vitest';
import { devCors, devCorsOrigins } from '../../server/middleware/devCors';

const run = (origins: Set<string>, method: string, origin?: string) => {
  const headers: Record<string, string> = {};
  const res: any = {
    setHeader: (k: string, v: string) => { headers[k] = v; },
    vary: (f: string) => { headers.Vary = f; },
    status: vi.fn(() => res),
    end: vi.fn(),
  };
  const next = vi.fn();
  devCors(origins)({ method, headers: origin ? { origin } : {} } as any, res, next);
  return { headers, res, next };
};

describe('devCors', () => {
  it('is off in production whatever the variable says', () => {
    expect(devCorsOrigins({ NODE_ENV: 'production', DEV_CORS_ORIGINS: 'http://localhost:5180' }).size).toBe(0);
  });

  it('accepts only exact localhost origins', () => {
    const o = devCorsOrigins({ NODE_ENV: 'development', DEV_CORS_ORIGINS: 'http://localhost:5180, https://evil.example, http://127.0.0.1:8080' });
    expect([...o]).toEqual(['http://localhost:5180', 'http://127.0.0.1:8080']);
  });

  it('leaves unknown origins untouched and never allows credentials', () => {
    const origins = new Set(['http://localhost:5180']);
    const other = run(origins, 'GET', 'http://localhost:9999');
    expect(other.next).toHaveBeenCalled();
    expect(other.headers['Access-Control-Allow-Origin']).toBeUndefined();
    // …but still varies by Origin, so the browser never reuses it cross-origin.
    expect(other.headers.Vary).toBe('Origin');

    const ok = run(origins, 'GET', 'http://localhost:5180');
    expect(ok.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5180');
    expect(ok.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('answers preflight without reaching the API', () => {
    const pre = run(new Set(['http://localhost:5180']), 'OPTIONS', 'http://localhost:5180');
    expect(pre.next).not.toHaveBeenCalled();
    expect(pre.res.status).toHaveBeenCalledWith(204);
  });
});
