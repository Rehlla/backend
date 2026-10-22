import { readJson } from '../../../../services/apiError';

const API_BASE = '/api/admin/content';

export async function cmsFetch(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || 'CMS API error');
  }
  return readJson(response, `CMS API call to ${path} failed.`);
}

/**
 * Derive a clean display filename from a media URL.
 *
 * The naive `url.split('/').pop()` kept the query string, producing filenames
 * like "photo-…?q=80&w=1600&auto=format&fit=crop" for CDN URLs. This strips
 * the query/hash, decodes percent-encoding, and falls back to a generic stem.
 */
export function deriveMediaFilename(url: string): string {
  try {
    const clean = url.split(/[?#]/)[0];
    const last = decodeURIComponent(clean.split('/').pop() || '').trim();
    return last || 'media';
  } catch {
    return 'media';
  }
}
