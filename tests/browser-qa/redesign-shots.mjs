/**
 * Redesign visual QA — full-page screenshots of priority routes.
 * Usage: node /tmp/redesign-shots.mjs [routeKey...]
 * Output: tests/browser-qa/screenshots/redesign/<key>-<vp>.png
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.QA_BASE || 'http://localhost:3000';
const OUT = 'tests/browser-qa/screenshots/redesign';
mkdirSync(OUT, { recursive: true });

const ROUTES = {
  home: '/',
  explore: '/explore',
  hotels: '/hotels',
  restaurants: '/restaurants',
  attractions: '/attractions',
  rentals: '/rentals',
  food: '/food',
  transfers: '/transfers/intercity',
  experiences: '/experiences',
  programs: '/programs',
  mytrip: '/my-trip',
  booknow: '/book-now',
  live: '/live',
  planforme: '/plan-for-me',
};

async function setupAuth(ctx) {
  try {
    const email = `rs-${Date.now()}@dahab.travel`;
    const res = await ctx.request.post(`${BASE}/api/auth/register`, {
      data: { name: 'QA', email, password: 'QA2026!', role: 'Traveler' },
    });
    const h = res.headers()['set-cookie'];
    if (h) {
      const m = h.match(/dahab_auth_token=([^;]+)/);
      if (m) await ctx.addCookies([{ name: 'dahab_auth_token', value: m[1], domain: 'localhost', path: '/' }]);
    }
  } catch (e) { console.log('  auth skipped:', e.message.split('\n')[0]); }
}

async function run() {
  const only = process.argv.slice(2).filter((a) => ROUTES[a]);
  const keys = only.length ? only : Object.keys(ROUTES);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(ctx);
  const page = await ctx.newPage();
  for (const key of keys) {
    const url = BASE + ROUTES[key];
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(1800);
      // settle lazy sections
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${key}-desktop.png`, fullPage: true });
      const h = await page.evaluate(() => document.body.scrollHeight);
      console.log(`OK ${key} height=${h}px`);
    } catch (e) {
      console.log(`FAIL ${key}: ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
}
run().catch((e) => { console.error(e); process.exit(1); });
