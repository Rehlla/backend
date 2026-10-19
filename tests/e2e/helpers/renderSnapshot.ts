import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { Page } from 'playwright/test';

const SNAP_DIR = 'tests/e2e/snapshots';

/**
 * Normalised outerHTML for byte-for-byte render comparison (used by §3 of the
 * fix plan). Removes the noise that legitimately varies between renders:
 *   - React's :r…: useId ids
 *   - collapsed whitespace runs
 *   - unsorted class-name tokens
 *   - relative "N mins ago" freshness labels
 */
export function normalizeHtml(html: string): string {
  let out = html;
  out = out.replace(/\bid=":r\d+:"/g, '');
  out = out.replace(/\b\d+\s*(mins?|minute[s]?|hrs?|hour[s]?|secs?|second[s]?)\s+ago\b/gi, '<time-ago>');
  out = out.replace(/class="([^"]*)"/g, (_m, cls: string) => {
    const tokens = cls.split(/\s+/).filter(Boolean).sort();
    return `class="${tokens.join(' ')}"`;
  });
  out = out.replace(/\s+/g, ' ');
  return out.trim();
}

async function pageLanguage(page: Page): Promise<string> {
  return page.evaluate(
    () => document.documentElement.lang || document.documentElement.dir || 'und',
  );
}

/**
 * Capture the current page into the baseline snapshot folder: one normalised
 * outerHTML file and one full-page PNG, keyed by document lang.
 */
export async function captureSnapshot(page: Page, tag: string): Promise<void> {
  const lang = await pageLanguage(page);
  const dir = path.join(SNAP_DIR, tag);
  mkdirSync(dir, { recursive: true });
  const html = normalizeHtml(await page.evaluate(() => document.body.outerHTML));
  writeFileSync(path.join(dir, `${lang}.html`), html, 'utf8');
  await page.screenshot({ path: path.join(dir, `${lang}.png`), fullPage: true });
}