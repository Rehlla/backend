import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Token discipline gate.
 *
 * The Luxury Re-Skin design system defines gold accents via CSS custom
 * properties (--accent-primary, --accent-secondary, --accent-primary-ink).
 * Hardcoded hex values like #C8933D break theming and must not appear in
 * component code.
 */

// Gold palette hex values that must be replaced with CSS vars
const GOLD_HEX = /#[Cc]8933[Dd]|#[Cc]9[Aa]24[Bb]|#[8f][Ff]6413|#[1a][Aa]1206|#[1a][Aa]1408/gi;

function collectSourceFiles(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'data' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) collectSourceFiles(p, out);
    else if (/\.(tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

describe('token discipline', () => {
  it('keeps hardcoded gold hex values out of component code', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(join(process.cwd(), 'src/components'), [])) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        // Allow hex in comments and strings that are documentation
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        if (GOLD_HEX.test(line)) {
          const shortFile = file.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');
          offenders.push(`${shortFile}:${i + 1} ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});