import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from '../db/sqlite/SqlitePersistenceAdapter';
import { db } from '../db/database';

// ============================================================================
// Theme Tokens — dashboard-editable brand/type overrides, applied OVER the
// active compiled theme (never instead of it).
// ============================================================================
//
// The six compiled themes (ThemeContext + index.css [data-theme-id] blocks)
// stay exactly as designed: the client applies these tokens as inline CSS
// variables AFTER the theme engine runs, so switching themes still works and
// unsetting a token restores the compiled value instantly. Only validated
// values are stored — hex colors, allow-listed font stacks (families already
// loaded by the app; no external font fetching), known theme ids — so no
// arbitrary CSS can ever reach the page.
//
// Tokens go LIVE immediately on save (no draft state), so writes are
// Operations/Admin-only, enforced per-endpoint in the router. Every write
// logs a restorable revision (entity_type 'theme').

export type ThemeTokenType = 'color' | 'font' | 'theme';

export interface ThemeTokenSpec {
  type: ThemeTokenType;
  /** CSS variables the client sets from this token (empty = behavior-only). */
  vars: string[];
  labelEn: string;
  labelAr: string;
}

export const THEME_TOKENS: Record<string, ThemeTokenSpec> = {
  'brand.accent': {
    type: 'color',
    vars: ['--accent-primary'],
    labelEn: 'Brand accent',
    labelAr: 'اللون الرئيسي',
  },
  'brand.accentSecondary': {
    type: 'color',
    vars: ['--accent-secondary'],
    labelEn: 'Secondary accent',
    labelAr: 'اللون الثانوي',
  },
  'type.display': {
    type: 'font',
    vars: ['--font-display'],
    labelEn: 'Display font',
    labelAr: 'خط العناوين',
  },
  'type.body': {
    type: 'font',
    vars: ['--font-sans'],
    labelEn: 'Body font',
    labelAr: 'خط النص',
  },
  'type.arabic': {
    type: 'font',
    vars: ['--font-arabic', '--font-arabic-display', '--font-arabic-body'],
    labelEn: 'Arabic font',
    labelAr: 'الخط العربي',
  },
  'brand.homeTheme': {
    type: 'theme',
    vars: [],
    labelEn: 'Default theme for new visitors',
    labelAr: 'السمة الافتراضية للزوار',
  },
};

export const THEME_TOKEN_KEYS = Object.keys(THEME_TOKENS);

/** Font stacks the app already loads — no external fetching, CSP-safe.
 *  One typeface only: SF Arabic (Apple), self-hosted from public/fonts and
 *  bundled in both Flutter apps. It covers the Arabic and Latin ranges the
 *  app renders, so every role (display, body, Arabic) resolves to it.
 *  `System` stays available for teams who want the OS face. */
export const FONT_STACKS: Record<string, string> = {
  'SF Arabic': "'SF Arabic', system-ui, sans-serif",
  System: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/** Font stacks that were offered before the move to SF Arabic. They are gone
 *  from the picker; a row that still holds one is rewritten to the default
 *  stack on read (see `normalizeFontStack`) so no Google font family can
 *  reach the page again. */
const RETIRED_FONT_STACKS = new Set([
  "'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif",
  "'Fraunces', 'Alexandria', Georgia, serif",
  "'Alexandria', 'IBM Plex Sans Arabic', sans-serif",
  "'IBM Plex Sans Arabic', system-ui, sans-serif",
  "'El Messiri', Georgia, serif",
  "'El Messiri', 'IBM Plex Sans Arabic', sans-serif",
  "'Cormorant Garamond', serif",
  "'Cormorant', 'Montserrat', sans-serif",
  "'Inter', system-ui, sans-serif",
  "'Readex Pro', system-ui, sans-serif",
  "'Plus Jakarta Sans', system-ui, sans-serif",
  "'Outfit', system-ui, sans-serif",
]);

/** The stack a retired font value falls back to. */
export const DEFAULT_FONT_STACK = FONT_STACKS['SF Arabic'];

/** Rewrite a retired Google font stack to the SF Arabic default. Anything
 *  already on the allow-list is returned untouched. */
export function normalizeFontStack(value: string): string {
  const v = value.trim();
  if (Object.values(FONT_STACKS).includes(v)) return v;
  if (RETIRED_FONT_STACKS.has(v)) return DEFAULT_FONT_STACK;
  return v;
}

/** Rewrite a stored retired font stack in place, so the row stops handing a
 *  Google font family to the page. Returns the value the page should see. */
function healRetiredFontStack(
  c: SqliteDb,
  key: string,
  value: string
): string {
  if (THEME_TOKENS[key]?.type !== 'font') return value;
  const normalized = normalizeFontStack(value);
  if (normalized === value) return value;
  c.prepare('UPDATE cms_theme SET value = ? WHERE key = ?').run(normalized, key);
  return normalized;
}

/** Mirrors ThemeId in src/context/ThemeContext.tsx — keep in sync. */
export const THEME_IDS = [
  'abyss',
  'salt',
  'high-contrast-pro',
] as const;

export function isThemeTokenKey(value: unknown): value is keyof typeof THEME_TOKENS {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(THEME_TOKENS, value);
}

function conn(): SqliteDb | null {
  const adapter = db.getAdapter();
  return adapter instanceof SqlitePersistenceAdapter ? adapter.connection : null;
}

function now(): string {
  return new Date().toISOString();
}

/** Strict per-type validation — the no-arbitrary-CSS boundary. */
export function assertThemeValue(key: keyof typeof THEME_TOKENS, value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`"${key}" must be a non-empty string.`);
  }
  const v = value.trim();
  const spec = THEME_TOKENS[key];
  if (spec.type === 'color') {
    if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
      throw new Error(`"${key}" must be a hex color like #10B981.`);
    }
    return v.toUpperCase();
  }
  if (spec.type === 'font') {
    const stacks = Object.values(FONT_STACKS);
    if (!stacks.includes(v)) {
      throw new Error(`"${key}" must be one of the offered font stacks.`);
    }
    return v;
  }
  if (!(THEME_IDS as readonly string[]).includes(v)) {
    throw new Error(`"${key}" must be one of: ${THEME_IDS.join(', ')}.`);
  }
  return v;
}

function logThemeRevision(key: string, action: string, actorId: string, actorName: string, value: string): void {
  const c = conn();
  if (!c) return;
  const id = `REV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  c.prepare(`
    INSERT INTO cms_revisions (id, entity_type, entity_id, action, actor_id, actor_name, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, 'theme', key, action, actorId || '', actorName || '', JSON.stringify({ value }), now());
}

export interface ThemeTokenValue {
  value: string;
  updatedAt: string;
}

export const siteTheme = {
  /** Set tokens only — unset keys render compiled theme values. */
  getAll(): Record<string, ThemeTokenValue> {
    const c = conn();
    if (!c) return {};
    const out: Record<string, ThemeTokenValue> = {};
    const rows = c.prepare('SELECT * FROM cms_theme').all() as {
      key: string; value: string; updated_at: string;
    }[];
    for (const r of rows) {
      if (!isThemeTokenKey(r.key)) continue;
      // A row that still holds a retired Google font stack is rewritten to the
      // SF Arabic default — the page must never receive a Google family again.
      const value = healRetiredFontStack(c, r.key, r.value || '');
      out[r.key] = { value, updatedAt: r.updated_at || '' };
    }
    return out;
  },

  /** Save (and immediately publish) one token. */
  upsert(keyRaw: unknown, valueRaw: unknown, actorId?: string, actorName?: string): ThemeTokenValue {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    if (!isThemeTokenKey(keyRaw)) {
      throw new Error(`Unknown theme token. Editable tokens: ${THEME_TOKEN_KEYS.join(', ')}.`);
    }
    const value = assertThemeValue(keyRaw, valueRaw);
    const ts = now();
    const existing = c.prepare('SELECT key FROM cms_theme WHERE key = ?').get(keyRaw);
    if (existing) {
      c.prepare('UPDATE cms_theme SET value = ?, updated_at = ? WHERE key = ?').run(value, ts, keyRaw);
      logThemeRevision(keyRaw, 'update', actorId || '', actorName || '', value);
    } else {
      c.prepare('INSERT INTO cms_theme (key, value, updated_at) VALUES (?, ?, ?)').run(keyRaw, value, ts);
      logThemeRevision(keyRaw, 'create', actorId || '', actorName || '', value);
    }
    return { value, updatedAt: ts };
  },

  /** Delete the override so the key renders the compiled theme value. */
  reset(keyRaw: unknown, actorId?: string, actorName?: string): boolean {
    const c = conn();
    if (!c) return false;
    if (!isThemeTokenKey(keyRaw)) {
      throw new Error(`Unknown theme token. Editable tokens: ${THEME_TOKEN_KEYS.join(', ')}.`);
    }
    const result = c.prepare('DELETE FROM cms_theme WHERE key = ?').run(keyRaw);
    if (result.changes > 0) {
      logThemeRevision(keyRaw, 'reset', actorId || '', actorName || '', '');
      return true;
    }
    return false;
  },

  /**
   * Restore a token to a previous revision snapshot. Snapshots store the full
   * post-state value; an empty snapshot resets to the compiled theme value.
   */
  rollback(keyRaw: unknown, revisionId: unknown, actorId?: string, actorName?: string): ThemeTokenValue | null {
    const c = conn();
    if (!c) return null;
    if (!isThemeTokenKey(keyRaw)) {
      throw new Error(`Unknown theme token. Editable tokens: ${THEME_TOKEN_KEYS.join(', ')}.`);
    }
    if (typeof revisionId !== 'string' || !revisionId) {
      throw new Error('"revisionId" is required.');
    }
    const revision = c
      .prepare('SELECT * FROM cms_revisions WHERE id = ? AND entity_type = ? AND entity_id = ?')
      .get(revisionId, 'theme', keyRaw) as Record<string, any> | undefined;
    if (!revision) return null;
    let snapshot: { value?: unknown } = {};
    try {
      snapshot = JSON.parse(revision.payload || '{}');
    } catch {
      return null;
    }
    const value = typeof snapshot.value === 'string' ? snapshot.value : '';
    const ts = now();
    if (!value) {
      c.prepare('DELETE FROM cms_theme WHERE key = ?').run(keyRaw);
    } else {
      // Re-validated: a hand-edited legacy revision can never smuggle CSS in.
      const clean = assertThemeValue(keyRaw, value);
      const existing = c.prepare('SELECT key FROM cms_theme WHERE key = ?').get(keyRaw);
      if (existing) {
        c.prepare('UPDATE cms_theme SET value = ?, updated_at = ? WHERE key = ?').run(clean, ts, keyRaw);
      } else {
        c.prepare('INSERT INTO cms_theme (key, value, updated_at) VALUES (?, ?, ?)').run(keyRaw, clean, ts);
      }
    }
    const out: ThemeTokenValue = { value: '', updatedAt: ts };
    const current = c.prepare('SELECT value, updated_at FROM cms_theme WHERE key = ?').get(keyRaw) as {
      value: string; updated_at: string;
    } | undefined;
    if (current) {
      out.value = current.value;
      out.updatedAt = current.updated_at;
    }
    logThemeRevision(keyRaw, 'rollback', actorId || '', actorName || '', out.value);
    return out;
  },

  /** Public bundle: set tokens + version stamp for client caching. */
  bundle(): { version: string; tokens: Record<string, string> } {
    const all = this.getAll();
    const tokens: Record<string, string> = {};
    let maxUpdated = '';
    for (const [key, entry] of Object.entries(all)) {
      if (!entry.value) continue;
      tokens[key] = entry.value;
      if (entry.updatedAt > maxUpdated) maxUpdated = entry.updatedAt;
    }
    return { version: bundleVersion(tokens, maxUpdated), tokens };
  },
};

/**
 * Version stamp: count + newest write + content hash. The hash matters:
 * two writes inside the same millisecond share an ISO timestamp, and
 * without it the second change would keep the first version — serving a
 * stale `unchanged:true` to cached clients.
 */
export function bundleVersion(tokens: Record<string, string>, maxUpdated: string): string {
  const keys = Object.keys(tokens).sort();
  let hash = 5381;
  for (const key of keys) {
    const s = `${key}=${tokens[key]};`;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
    }
  }
  return `${keys.length}:${maxUpdated}:${(hash >>> 0).toString(36)}`;
}
