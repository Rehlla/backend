import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TRANSLATIONS } from '../../src/i18n/translations';

/**
 * Emoji discipline gate.
 *
 * The UI-icon sweep (Phase 1) replaced every color-emoji-as-icon with the
 * Lucide `CategoryIcon` primitive. Color emoji are banned in `src/`: they
 * render inconsistently across platforms, ignore the theme palette, and
 * break the Luxury Re-Skin glyph language. The typographic dingbats ★ ☆ ☐
 * ☑ ☒ (monochrome text glyphs that inherit color) remain allowed; the
 * VS16 variation selector is banned because it forces emoji presentation.
 */

const COLOR_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2600}-\u{26FF}]/u;
// Monochrome typographic glyphs that stay legal: ★ ☆ ☐ ☑ ☒
// Global: a line can legally carry more than one of these, and a non-global
// replace strips only the first - which passed a single-star line and then
// failed a bilingual label like 'Highest Rated (★)' / 'الأعلى تقييماً (★)' for
// the second one it left behind.
const ALLOWED_DINGBATS = /[\u{2605}\u{2606}\u{2610}\u{2611}\u{2612}]/gu;

function collectSourceFiles(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'data' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) collectSourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

describe('emoji discipline', () => {
  it('keeps color emoji out of src/ code', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(join(process.cwd(), 'src'), [])) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const cleaned = line.replace(ALLOWED_DINGBATS, '');
        if (COLOR_EMOJI.test(cleaned)) offenders.push(`${file}:${i + 1} ${line.trim().slice(0, 80)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

    it('allows a line to carry more than one typographic dingbat', () => {
    // The gate strips the typographic dingbats before testing, because
    // COLOR_EMOJI covers U+2600-26FF and so matches a star directly. A
    // bilingual label puts the glyph in BOTH languages on one line, and the
    // strip must handle every occurrence - a non-global replace left the
    // second one behind and flagged the line as a violation.
    const star = String.fromCodePoint(0x2605);
    const arabic = String.fromCodePoint(0x627, 0x644, 0x623, 0x639, 0x644, 0x649, 0x20, 0x62a, 0x642, 0x64a, 0x64a, 0x645, 0x627, 0x64b);
    const line = `Rated ${star} | ${arabic} (${star})`;

    // The glyph itself sits inside the emoji range.
    expect(COLOR_EMOJI.test(star)).toBe(true);
    expect(line.split(star).length - 1).toBe(2);

    // Stripped the way the gate strips it, the line is clean - both of them.
    expect(COLOR_EMOJI.test(line.replace(ALLOWED_DINGBATS, ''))).toBe(false);

    // And a real color emoji on the same line is still caught after stripping.
    const mixed = `${line} ${String.fromCodePoint(0x1f30a)}`;
    expect(COLOR_EMOJI.test(mixed.replace(ALLOWED_DINGBATS, ''))).toBe(true);
  });



  it('keeps color emoji out of user-facing translations', () => {
    const offenders = Object.entries(TRANSLATIONS)
      .filter(([, v]) => COLOR_EMOJI.test(v.en) || COLOR_EMOJI.test(v.ar))
      .map(([k, v]) => `${k} -> ${v.en} / ${v.ar}`);
    expect(offenders).toEqual([]);
  });
});
