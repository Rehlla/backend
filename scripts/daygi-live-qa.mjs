/* eslint-disable */
/**
 * Live DayGi browser QA v2: fresh page per query, submit via the form button,
 * wait for the NEW reply (page text must contain the expected venue names).
 * Run: node scripts/daygi-live-qa.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://172.22.48.1:3000';
const QUERIES = [
  { q: 'Best diving in Dahab', expect: 'Scuba Seekers|Big Blue Dahab' },
  { q: 'عايز مطعم حلو كويس في دهب', expect: 'Zanooba|Lindy|Shark' },
  { q: 'things to do in Nuweiba', expect: 'Nature Travel|Dar Jan|Venus|Ain Khudra' },
  { q: 'رحلات في سيوة', expect: 'Siwa Oasis' },
  { q: 'أحسن فنادق في دهب', expect: 'JAZ|Movenpick|Tropitel|Swiss|Hilton' },
];

const email = `qa-${Date.now()}@dahab.travel`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const res = await context.request.post(`${BASE}/api/auth/register`, {
  data: { name: 'QA DayGi', email, password: 'QA2026!', role: 'Traveler' },
});
if (!res.ok()) { console.log('register failed:', res.status()); process.exit(1); }
const cookie = (res.headers()['set-cookie'] || '').match(/dahab_auth_token=([^;]+)/);
await context.addCookies([{ name: 'dahab_auth_token', value: cookie[1], domain: '172.22.48.1', path: '/' }]);

for (const { q, expect } of QUERIES) {
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.locator('button', { hasText: /DayGi|دايجي/i }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);
    const box = page.locator('form input[type="text"]').last();
    await box.fill(q);
    await page.locator('form button[type="submit"]').last().click();
    // wait up to 25s for any expected venue name to appear in the panel
    const names = expect.split('|');
    let found = null;
    try {
      await page.waitForFunction(
        (names) => {
          const t = document.body.innerText;
          return names.some((n) => t.includes(n));
        },
        names,
        { timeout: 25000 },
      );
      found = names.find((n) => page.locator('body').innerText().then ? null : null);
    } catch { /* timeout */ }
    const text = await page.locator('body').innerText();
    found = names.find((n) => text.includes(n)) || null;
    console.log(`\nQ: ${q}`);
    console.log(`   ${found ? 'PASS ✓ ' + found : 'FAIL ✗ (none of: ' + expect + ')'}`);
    const idx = text.lastIndexOf('Top-rated');
    if (idx >= 0) console.log('   head:', text.slice(idx, idx + 150).replace(/\n/g, ' | '));
    else {
      // show the last assistant-ish line for debugging
      const lines = text.split('\n').filter((l) => l.trim().length > 30);
      console.log('   tail:', lines.slice(-3).join(' | ').slice(0, 200));
    }
  } catch (e) {
    console.log(`\nQ: ${q}\n   ERROR: ${String(e).slice(0, 200)}`);
  } finally {
    await page.close();
  }
}
await browser.close();
console.log('\nQA v2 done');
