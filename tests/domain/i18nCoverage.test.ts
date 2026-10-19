import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { TRANSLATIONS } from '../../src/i18n/translations';
import { findLiteralEscape } from '../../server/services/textIntegrity';

/**
 * Bilingual completeness gate.
 *
 * Absent Arabic used to render English silently (translate() falls back to
 * `en`), so untranslated keys shipped invisible. Every key must carry both
 * languages, placeholders must match (or interpolation prints raw {var} in
 * one language), and values must not contain literal escape sequences
 * (see textIntegrity.ts — pasted JSON escapes that render as backslash-u).
 */

function placeholders(text: string): string[] {
  const found = text.match(/\{[a-zA-Z0-9_]+\}/g) || [];
  return [...new Set(found)].sort();
}

describe('i18n coverage', () => {
  const entries = Object.entries(TRANSLATIONS);

  it('has substantial bilingual coverage', () => {
    expect(entries.length).toBeGreaterThan(1000);
  });

  it('gives every key a non-empty English and Arabic string', () => {
    const missingAr = entries.filter(([, v]) => !v.ar || !v.ar.trim()).map(([k]) => k);
    const missingEn = entries.filter(([, v]) => !v.en || !v.en.trim()).map(([k]) => k);
    expect(missingAr).toEqual([]);
    expect(missingEn).toEqual([]);
  });

  it('keeps {placeholder} sets identical between languages', () => {
    const mismatched = entries
      .filter(([, v]) => placeholders(v.en).join(',') !== placeholders(v.ar).join(','))
      .map(([k]) => k);
    expect(mismatched).toEqual([]);
  });

  it('contains no literal escape sequences in any value', () => {
    const dirty = entries.flatMap(([k, v]) => {
      const bad: string[] = [];
      if (findLiteralEscape(v.en)) bad.push(`${k}.en`);
      if (findLiteralEscape(v.ar)) bad.push(`${k}.ar`);
      return bad;
    });
    expect(dirty).toEqual([]);
  });

  it('every literal key used by the Intelligence Core UI carries both languages', () => {
    // The Core UI calls t('key', 'fallback') — a fallback silently hides a
    // missing translation, so AR users see English. Scan the Core surface and
    // require every static key it uses to exist in TRANSLATIONS (both langs).
    const dir = join(process.cwd(), 'src', 'components', 'intelligence-core');
    const files = readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    const source = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
    const keyRe = /\bt\(\s*'([a-zA-Z][a-zA-Z0-9_.]*)'/g;
    const used = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = keyRe.exec(source)) !== null) used.add(m[1]);
    const missing = [...used].filter(k => !TRANSLATIONS[k] || !TRANSLATIONS[k].en?.trim() || !TRANSLATIONS[k].ar?.trim());
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(30);
  });

  it('uses sane key names (dotted, no spaces, ASCII)', () => {
    const malformed = entries
      .map(([k]) => k)
      .filter(k => !/^[A-Za-z0-9_.-]+$/.test(k) || k.includes('..') || k.startsWith('.') || k.endsWith('.'));
    expect(malformed).toEqual([]);
  });
});
