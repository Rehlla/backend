import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import * as imagery from '../../src/shared/placeholderImagery';

/**
 * §6e guard — the Unsplash bleed must not resume.
 *
 * Every remote placeholder URL lives in `src/shared/placeholderImagery.ts`.
 * Before that registry existed, ~150 inline `images.unsplash.com` literals
 * were scattered across `src/` with three different transform-parameter
 * styles for the same photo (full-resolution ones included). This test
 * fails when a new inline literal appears, so future imagery goes through
 * the registry — where the eventual swap to CMS media (`cms_media`) is a
 * one-file change.
 */

const ALLOWED_FILES = new Set([
  // The registry itself.
  'src/shared/placeholderImagery.ts',
  // Payment file is out of scope for every mechanical sweep (remediation plan §1/§3).
  'src/components/booking/BookingPaymentStep.tsx',
  // These two matches are input *placeholders* (`placeholder="https://images.unsplash.com/..."`),
  // not image URLs.
  'src/components/operations/command-center/CmsContentDashboard.tsx',
  'src/components/operations/command-center/CmsPageEditor.tsx'
]);

const UNSPLASH_RE = /https:\/\/images\.unsplash\.com\//;

function listSrcFiles(): string[] {
  return execSync('git ls-files --cached --others --exclude-standard "src/**/*.tsx" "src/**/*.ts"', {
    encoding: 'utf8'
  })
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f, i, all) => all.indexOf(f) === i);
}

describe('placeholderImagery registry', () => {
  it('no inline Unsplash URLs outside the registry (add a constant instead)', () => {
    const offenders: string[] = [];
    for (const file of listSrcFiles()) {
      if (ALLOWED_FILES.has(file)) continue;
      if (!existsSafe(file)) continue;
      const src = readFileSync(file, 'utf8');
      if (UNSPLASH_RE.test(src)) offenders.push(file);
    }
    expect(offenders, `Inline Unsplash URLs found in:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every registry constant uses the normalized transform parameters', () => {
    const registrySrc = readFileSync('src/shared/placeholderImagery.ts', 'utf8');
    // The PARAMS suffixes the curated constants interpolate; the generated
    // constants inline the params. Both must normalize.
    const paramLiterals: Record<string, string> = {};
    for (const m of registrySrc.matchAll(/(\w+):\s*['"`]([^'"`]+)['"`]/g)) {
      if (m[2].includes('q=') || m[2].includes('w=')) paramLiterals[m[1]] = m[2];
    }
    const bad: string[] = [];
    for (const m of registrySrc.matchAll(/export const (IMG_[A-Za-z0-9_]+) = `([^`]+)`/g)) {
      const url = m[2].replace(/\$\{PARAMS\.(\w+)\}/g, (_s, key: string) => paramLiterals[key] ?? '');
      const ok = /[?&]q=80/.test(url) && /[?&]w=\d+/.test(url) && /[?&]auto=format/.test(url) && /[?&]fit=crop/.test(url);
      if (!ok) bad.push(`${m[1]}: ${url}`);
    }
    expect(bad, `Constants missing normalized params:\n${bad.join('\n')}`).toEqual([]);
  });

  it('exported constants are absolute https URLs', () => {
    for (const [name, url] of Object.entries(imagery)) {
      if (typeof url !== 'string') continue;
      expect(url, name).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9-]+\?/);
    }
  });
});

function existsSafe(file: string): boolean {
  try {
    readFileSync(file);
    return true;
  } catch {
    return false;
  }
}
