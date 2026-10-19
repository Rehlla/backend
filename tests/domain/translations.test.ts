import { describe, it, expect, vi, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { translate, TRANSLATIONS } from '../../src/i18n/translations';

const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

const keys = Object.keys(TRANSLATIONS);

function placeholders(text: string): string[] {
  const matches = text.match(/\{([a-zA-Z0-9_]+)\}/g) ?? [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

describe('translation catalog invariants', () => {
  it('has no empty en/ar strings and every key is a non-empty string', () => {
    for (const key of keys) {
      expect(key.length, `key must be non-empty: ${key}`).toBeGreaterThan(0);
      expect(TRANSLATIONS[key].en.length, `en empty for ${key}`).toBeGreaterThan(0);
      expect(TRANSLATIONS[key].ar.length, `ar empty for ${key}`).toBeGreaterThan(0);
    }
  });

  it('has matching {placeholder} sets between en and ar for every key', () => {
    for (const key of keys) {
      const en = placeholders(TRANSLATIONS[key].en);
      const ar = placeholders(TRANSLATIONS[key].ar);
      expect(en, `placeholder mismatch in ${key} (en=${en.join(',')} vs ar=${ar.join(',')})`).toEqual(ar);
    }
  });

  it('holds human copy only — never JSX or JS expressions (the §5 codemod dumped component source into values, rendering literally in the hero)', () => {
    const offenders: string[] = [];
    for (const key of keys) {
      for (const lang of ['en', 'ar'] as const) {
        const text = TRANSLATIONS[key][lang];
        if (
          text.includes('<>') ||
          text.includes('</') ||
          text.includes('/>') ||
          text.includes('className') ||
          text.includes('===') ||
          text.includes('=>') ||
          text.includes("{'") ||
          text.includes("? '")
        ) {
          offenders.push(`${key}.${lang}`);
        }
      }
    }
    expect(offenders, `catalog values holding code/JSX: ${offenders.join(', ')}`).toEqual([]);
  });

  it('warns once per unreferenced key — a soft diagnostic, not a failure', () => {
    const root = path.resolve(__dirname, '../../src');
    const tUsages = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const body = fs.readFileSync(full, 'utf8');
          const re = /t\(\s*(['"])([^'"]+)\1/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(body))) tUsages.add(m[2]);
        }
      }
    };
    walk(root);
    const unreferenced = keys.filter((k) => !tUsages.has(k));
    if (unreferenced.length) {
      console.warn(`[i18n] ${unreferenced.length} catalog keys are not referenced by any t('...') literal:\n  ${unreferenced.slice(0, 30).join('\n  ')}`);
    }
  });
});

describe('translate', () => {
  it('resolves the active language', () => {
    expect(translate('nav.myTrip', 'en')).toBe('My Trip');
    expect(translate('nav.myTrip', 'ar')).toBe('رحلتي');
  });

  it('returns the fallback when the key is missing', () => {
    expect(translate('definitely.missing', 'en', undefined, 'fallback')).toBe('fallback');
  });

  it('returns the key itself when missing and no fallback', () => {
    const out = translate('definitely.missing', 'ar');
    expect(out).toBe('definitely.missing');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('interpolates vars in both languages', () => {
    expect(translate('hotels.availabilityOpen', 'en', { date: '2026-09-10', rooms: 2 })).not.toContain(
      '{rooms}'
    );
    expect(translate('hotels.availabilityOpen', 'ar', { date: '2026-09-10', rooms: 2 })).not.toContain(
      '{rooms}'
    );
  });

  it('resolves a real interpolated catalog entry for both languages', () => {
    const en = translate('hotels.subtitle', 'en', { count: 12 });
    expect(en).toContain('12');
    expect(en).not.toContain('{count}');
    const ar = translate('hotels.subtitle', 'ar', { count: 12 });
    expect(ar).toContain('12');
    expect(ar).not.toContain('{count}');
  });
});