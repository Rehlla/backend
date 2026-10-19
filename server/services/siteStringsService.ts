import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from '../db/sqlite/SqlitePersistenceAdapter';
import { db } from '../db/database';
import { TRANSLATIONS } from '../../src/i18n/translations';
import { assertNoLiteralEscapes } from './textIntegrity';

// ============================================================================
// Site Strings — dashboard-editable UI copy overrides
// ============================================================================
//
// src/i18n/translations.ts owns the key set and the defaults. This service
// stores only per-key EN/AR overrides in cms_strings. The public bundle ships
// overrides only (it starts empty and stays small); the client merges them
// over the compiled defaults, so:
//
// - a fresh checkout renders identically with zero rows,
// - newly added code keys appear automatically with code values,
// - resetting a key is a row delete — catalog truth is never forked.
//
// Overrides go LIVE immediately on save (there is no draft state for UI
// copy). Every write logs a full-snapshot revision (entity_type
// 'site_string') so any change can be restored, and the dashboard warns that
// saving publishes instantly. Because a save is effectively a publish, only
// Operations and Admin may write — enforced per-endpoint in the router.

export const MAX_STRING_LENGTH = 2000;

export interface SiteStringOverride {
  key: string;
  value_en: string;
  value_ar: string;
  updated_by: string;
  updated_at: string;
}

export interface MergedSiteString {
  key: string;
  group: string;
  code_en: string;
  code_ar: string;
  override_en: string;
  override_ar: string;
  /** Effective values: override when set, otherwise code. */
  value_en: string;
  value_ar: string;
  customized: boolean;
  updated_at: string;
  updated_by: string;
}

function conn(): SqliteDb | null {
  const adapter = db.getAdapter();
  return adapter instanceof SqlitePersistenceAdapter ? adapter.connection : null;
}

function now(): string {
  return new Date().toISOString();
}

export function stringGroup(key: string): string {
  const dot = key.indexOf('.');
  return dot > 0 ? key.slice(0, dot) : 'misc';
}

function assertKnownKey(key: unknown): string {
  if (typeof key !== 'string' || !key) {
    throw new Error('"key" is required and must be a non-empty string.');
  }
  if (!Object.prototype.hasOwnProperty.call(TRANSLATIONS, key)) {
    throw new Error(
      `Unknown string key "${key}". Keys are owned by code (src/i18n/translations.ts) — ` +
      'the dashboard can only override values, never create keys.'
    );
  }
  return key;
}

function assertValue(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`"${field}" must be a string.`);
  }
  if (value.length > MAX_STRING_LENGTH) {
    throw new Error(`"${field}" must be at most ${MAX_STRING_LENGTH} characters.`);
  }
  return value;
}

function logStringRevision(
  key: string,
  action: string,
  actorId: string,
  actorName: string,
  snapshot: { value_en: string; value_ar: string }
): void {
  const c = conn();
  if (!c) return;
  const id = `REV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  c.prepare(`
    INSERT INTO cms_revisions (id, entity_type, entity_id, action, actor_id, actor_name, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, 'site_string', key, action, actorId || '', actorName || '', JSON.stringify(snapshot), now());
}

export const siteStrings = {
  /** Raw override row, or null when the key still renders code defaults. */
  findOverride(key: string): SiteStringOverride | null {
    const c = conn();
    if (!c) return null;
    const row = c.prepare('SELECT * FROM cms_strings WHERE key = ?').get(key) as SiteStringOverride | undefined;
    return row ? { ...row } : null;
  },

  /** Every override, newest first. */
  findAllOverrides(limit = 5000): SiteStringOverride[] {
    const c = conn();
    if (!c) return [];
    const cap = Math.min(Math.max(limit, 1), 10000);
    return (c.prepare('SELECT * FROM cms_strings ORDER BY updated_at DESC LIMIT ?').all(cap) as SiteStringOverride[]).map(r => ({ ...r }));
  },

  /**
   * Save (and immediately publish) an override. At least one of value_en /
   * value_ar must be a non-empty string; an omitted side keeps rendering the
   * code default for that language.
   */
  upsert(
    keyRaw: unknown,
    values: { value_en?: unknown; value_ar?: unknown },
    actorId?: string,
    actorName?: string
  ): SiteStringOverride {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    const key = assertKnownKey(keyRaw);
    const hasEn = values.value_en !== undefined;
    const hasAr = values.value_ar !== undefined;
    if (!hasEn && !hasAr) {
      throw new Error('Provide at least one of "value_en" / "value_ar".');
    }
    const existing = this.findOverride(key);
    const value_en = hasEn ? assertValue(values.value_en, 'value_en') : existing?.value_en || '';
    const value_ar = hasAr ? assertValue(values.value_ar, 'value_ar') : existing?.value_ar || '';
    if (!value_en && !value_ar) {
      throw new Error('Provide a non-empty "value_en" and/or "value_ar". To restore code defaults, reset the key instead.');
    }
    assertNoLiteralEscapes({ value_en, value_ar }, ['value_en', 'value_ar']);
    const ts = now();
    if (existing) {
      c.prepare('UPDATE cms_strings SET value_en = ?, value_ar = ?, updated_by = ?, updated_at = ? WHERE key = ?')
        .run(value_en, value_ar, actorId || '', ts, key);
    } else {
      c.prepare('INSERT INTO cms_strings (key, value_en, value_ar, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(key, value_en, value_ar, actorId || '', ts);
    }
    logStringRevision(key, existing ? 'update' : 'create', actorId || '', actorName || '', { value_en, value_ar });
    return this.findOverride(key)!;
  },

  /** Delete the override so the key renders code defaults again. */
  reset(keyRaw: unknown, actorId?: string, actorName?: string): boolean {
    const c = conn();
    if (!c) return false;
    const key = assertKnownKey(keyRaw);
    const result = c.prepare('DELETE FROM cms_strings WHERE key = ?').run(key);
    if (result.changes > 0) {
      logStringRevision(key, 'reset', actorId || '', actorName || '', { value_en: '', value_ar: '' });
      return true;
    }
    return false;
  },

  /**
   * Restore a key to a previous revision snapshot. Snapshots are full
   * post-states ({ value_en, value_ar }); an empty snapshot resets to code.
   */
  rollback(keyRaw: unknown, revisionId: unknown, actorId?: string, actorName?: string): MergedSiteString | null {
    const c = conn();
    if (!c) return null;
    const key = assertKnownKey(keyRaw);
    if (typeof revisionId !== 'string' || !revisionId) {
      throw new Error('"revisionId" is required.');
    }
    const revision = c
      .prepare('SELECT * FROM cms_revisions WHERE id = ? AND entity_type = ? AND entity_id = ?')
      .get(revisionId, 'site_string', key) as Record<string, any> | undefined;
    if (!revision) return null;
    let snapshot: { value_en?: unknown; value_ar?: unknown } = {};
    try {
      snapshot = JSON.parse(revision.payload || '{}');
    } catch {
      return null;
    }
    const value_en = typeof snapshot.value_en === 'string' ? snapshot.value_en : '';
    const value_ar = typeof snapshot.value_ar === 'string' ? snapshot.value_ar : '';
    if (!value_en && !value_ar) {
      this.reset(key, actorId, actorName);
    } else {
      this.upsert(key, { value_en, value_ar }, actorId, actorName);
    }
    logStringRevision(key, 'rollback', actorId || '', actorName || '', { value_en, value_ar });
    return this.merged(key);
  },

  /** Code defaults merged with the override — what the dashboard edits. */
  merged(keyRaw: unknown): MergedSiteString | null {
    const key = typeof keyRaw === 'string' ? keyRaw : '';
    const code = (TRANSLATIONS as Record<string, { en: string; ar: string }>)[key];
    if (!code) return null;
    const over = this.findOverride(key);
    return {
      key,
      group: stringGroup(key),
      code_en: code.en,
      code_ar: code.ar,
      override_en: over?.value_en || '',
      override_ar: over?.value_ar || '',
      value_en: over?.value_en || code.en,
      value_ar: over?.value_ar || code.ar,
      customized: !!over,
      updated_at: over?.updated_at || '',
      updated_by: over?.updated_by || '',
    };
  },

  /**
   * Full merged catalog for the dashboard (3229 code keys + override state).
   * Filtered in memory — one pass, no per-key queries. `limit` is capped for
   * interactive use; pass `fetchAll` for complete dumps (export), which need
   * every key or translators work from a truncated file.
   */
  catalog(opts?: { q?: string; group?: string; customizedOnly?: boolean; limit?: number; offset?: number; fetchAll?: boolean }): {
    total: number;
    groups: { group: string; count: number; customized: number }[];
    strings: MergedSiteString[];
  } {
    const q = (opts?.q || '').trim().toLowerCase();
    const group = opts?.group || '';
    const customizedOnly = !!opts?.customizedOnly;
    const limit = opts?.fetchAll ? Number.MAX_SAFE_INTEGER : Math.min(Math.max(opts?.limit ?? 200, 1), 1000);
    const offset = Math.max(opts?.offset ?? 0, 0);

    const overrides = new Map(this.findAllOverrides().map(o => [o.key, o]));
    const groupStats = new Map<string, { count: number; customized: number }>();
    const matched: MergedSiteString[] = [];

    for (const [key, code] of Object.entries(TRANSLATIONS)) {
      const g = stringGroup(key);
      const over = overrides.get(key);
      const stat = groupStats.get(g) || { count: 0, customized: 0 };
      stat.count += 1;
      if (over) stat.customized += 1;
      groupStats.set(g, stat);

      if (group && g !== group) continue;
      if (customizedOnly && !over) continue;
      if (q && !`${key} ${code.en} ${code.ar} ${over?.value_en || ''} ${over?.value_ar || ''}`.toLowerCase().includes(q)) continue;
      matched.push({
        key,
        group: g,
        code_en: code.en,
        code_ar: code.ar,
        override_en: over?.value_en || '',
        override_ar: over?.value_ar || '',
        value_en: over?.value_en || code.en,
        value_ar: over?.value_ar || code.ar,
        customized: !!over,
        updated_at: over?.updated_at || '',
        updated_by: over?.updated_by || '',
      });
    }

    const groups = [...groupStats.entries()]
      .map(([g, s]) => ({ group: g, count: s.count, customized: s.customized }))
      .sort((a, b) => a.group.localeCompare(b.group));
    return { total: matched.length, groups, strings: matched.slice(offset, offset + limit) };
  },

  /** Public bundle: overrides only + a version stamp for client caching. */
  bundle(): { version: string; count: number; strings: Record<string, { en: string; ar: string }> } {
    const rows = this.findAllOverrides();
    const strings: Record<string, { en: string; ar: string }> = {};
    let maxUpdated = '';
    for (const r of rows) {
      const code = (TRANSLATIONS as Record<string, { en: string; ar: string }>)[r.key];
      if (!code) continue;
      strings[r.key] = { en: r.value_en || code.en, ar: r.value_ar || code.ar };
      if (r.updated_at > maxUpdated) maxUpdated = r.updated_at;
    }
    return { version: bundleVersion(strings, maxUpdated), count: rows.length, strings };
  },
};

/**
 * Version stamp: count + newest write + content hash (see themeService —
 * same-millisecond writes share an ISO timestamp, so count+time alone can
 * serve a stale `unchanged:true`).
 */
export function bundleVersion(strings: Record<string, { en: string; ar: string }>, maxUpdated: string): string {
  const keys = Object.keys(strings).sort();
  let hash = 5381;
  for (const key of keys) {
    const s = `${key}=${strings[key].en}|${strings[key].ar};`;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
    }
  }
  return `${keys.length}:${maxUpdated}:${(hash >>> 0).toString(36)}`;
}
