import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { addSource, updateSource } from '../../server/services/accommodationService';
import type { AccommodationEntity } from '../../server/db/schema';

/**
 * Property source links render on the public stay page ("Also listed on"),
 * so only a full https:// address may be stored — never javascript:, data:
 * or a plain-http page.
 */
describe('property source links', () => {
  beforeEach(() => {
    resetDb();
    db.accommodations.push({ id: 'ACC-SRC' } as AccommodationEntity);
  });

  const add = (url: string) =>
    addSource({ accommodationId: 'ACC-SRC', sourceType: 'WEBSITE' as never, url, addedByUserId: 'USR-OPS' });

  it('stores an https link', () => {
    expect(add('https://example.com/hotel').url).toBe('https://example.com/hotel');
  });

  it('refuses anything that is not https', () => {
    for (const bad of ['javascript:alert(1)', 'http://example.com', 'data:text/html,hi', 'example.com', 'https://bad link']) {
      expect(() => add(bad), bad).toThrow(/https:\/\//);
    }
  });

  it('refuses an edit that swaps in a non-https link', () => {
    const source = add('https://example.com/hotel');
    expect(() => updateSource(source.id, { url: 'javascript:alert(1)' })).toThrow(/https:\/\//);
    expect(updateSource(source.id, { label: 'Official site' }).url).toBe('https://example.com/hotel');
  });
});
