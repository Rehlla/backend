import { describe, it, expect, vi, afterEach } from 'vitest';
import { log, withCorrelation } from '../../server/services/structuredLogger';

describe('structured logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits JSON lines with level, timestamp, module and message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('analytics', 'batch ingested', { stored: 3 });
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe('info');
    expect(parsed.module).toBe('analytics');
    expect(parsed.message).toBe('batch ingested');
    expect(parsed.stored).toBe(3);
    expect(parsed.timestamp).toBeTruthy();
  });

  it('carries the correlationId from the surrounding context', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    withCorrelation('req-abc-123', () => {
      log.info('test', 'inside request');
    });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.correlationId).toBe('req-abc-123');
  });

  it('leaves correlationId undefined outside a request context', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('test', 'outside request');
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.correlationId).toBeUndefined();
  });

  it('routes errors to console.error', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.error('checkout', 'capture failed', { error: 'gateway timeout' });
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(errSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.error).toBe('gateway timeout');
  });

  it('filters debug below the configured info level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.debug('test', 'should be filtered');
    expect(spy).not.toHaveBeenCalled();
    log.info('test', 'should pass');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});