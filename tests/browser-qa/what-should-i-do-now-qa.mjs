/**
 * "What Should I Do Now?" — Browser QA for the revived /api/context/fit-window
 * layer (§4 of the Arabic remediation plan).
 *
 *   - live mode EN: registered traveler with a trip opens Tools → "What should
 *     I do now?" and sees the three SERVER fit-window options (mapped via
 *     spontaneousMapper), not the curated fallback
 *   - live mode AR: same flow after toggling language — Arabic titles render
 *     and the document flips to RTL
 *   - fallback mode: /api/context/fit-window stubbed to 500 → the view still
 *     renders the three curated fallback options (formatted, no crash) and no
 *     live title leaks through
 *   - no prototype-switcher UI may survive in any mode
 *
 * Requires the dev/production server already running on http://localhost:3000
 * (like the other tests/browser-qa scripts). Screenshots land in
 * screenshots/what-should-i-do-now/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/browser-qa/screenshots/what-should-i-do-now', { recursive: true });

const BASE = process.env.QA_BASE || 'http://localhost:3000';
const COOKIE_DOMAIN = new URL(BASE).hostname;
const ISSUES = [];
function issue(sev, area, desc) {
  ISSUES.push({ sev, area, desc });
  console.log(`  ${sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🔵'} [${area}] ${desc}`);
}

const LIVE_EN = 'Morning Drift Snorkel at Eel Garden';
const LIVE_EN_2 = 'Freediving Line Session & Float';
const LIVE_AR = 'سنوركلينج وانسياب صباحي في الإيل جاردن';
const FALLBACK = 'Lighthouse + Coffee';

const SAMPLE_ITINERARY = {
  tripTitle: 'QA Spontaneous Window Trip',
  days: [
    {
      dayNumber: 1,
      activities: [
        { title: 'Guided Morning Dive at The Canyon', timeSlot: '09:00 AM', category: 'diving', estimatedPriceEGP: 1350, location: 'The Canyon' }
      ]
    }
  ]
};

async function setupTraveler(context) {
  const email = `wsidn-${Date.now()}@dahab.travel`;
  const res = await context.request.post(`${BASE}/api/auth/register`, {
    data: { name: 'What Should I Do Now QA', email, password: 'QA2026!', role: 'Traveler' }
  });
  const h = res.headers()['set-cookie'] || '';
  const m = h.match(/dahab_auth_token=([^;]+)/);
  if (!m) return false;
  await context.addCookies([{ name: 'dahab_auth_token', value: m[1], domain: COOKIE_DOMAIN, path: '/' }]);

  const saved = await (await context.request.post(`${BASE}/api/trip/apply-ai`, {
    data: { itinerary: SAMPLE_ITINERARY, lengthDays: 1, travelersCount: 1, budget: 'Moderate', pace: 'Balanced', interests: ['Diving'] }
  })).json().catch(() => null);
  return Boolean(saved?.trip?.id);
}

async function openSpontaneous(page) {
  await page.goto(`${BASE}/my-trip`, { waitUntil: 'networkidle' });
  await page.locator('#dashboard-tab-tools').click({ timeout: 8000 });
  await page.locator('#tool-card-spontaneous').click({ timeout: 8000 });
  await page.locator('#three-recommendations-section').waitFor({ timeout: 15000 });
  // Let the /api/context/fit-window fetch settle before asserting on option
  // identity (loading keeps the curated fallback visible briefly).
  await page.waitForTimeout(1500);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ── EN live mode ────────────────────────────────────────────────────────
  console.log('\n━━━ EN live mode ━━━');
  const en = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await en.newPage();

  if (!(await setupTraveler(en))) {
    issue('high', 'setup', 'could not register QA traveler / create trip');
  } else {
    await openSpontaneous(page);
    await page.screenshot({ path: 'tests/browser-qa/screenshots/what-should-i-do-now/en-live.png', fullPage: true });
    const hasLive = (await page.getByText(LIVE_EN).count()) > 0 || (await page.getByText(LIVE_EN_2).count()) > 0;
    const hasFallback = (await page.getByText(FALLBACK).count()) > 0;
    const hasSwitcher = (await page.getByText(/prototype/i).count()) > 0;
    console.log(`  live option present=${hasLive} fallbackLeaked=${hasFallback} prototypeUi=${hasSwitcher}`);
    if (!hasLive) issue('high', 'live-en', 'server fit-window option did not render');
    if (hasFallback) issue('high', 'live-en', 'curated fallback leaked into live mode');
    if (hasSwitcher) issue('high', 'live-en', 'prototype switcher UI survived');
  }
  await en.close();

  // ── AR live mode ────────────────────────────────────────────────────────
  console.log('\n━━━ AR live mode ━━━');
  const ar = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  // Seed the persisted language preference so the app boots in Arabic without
  // depending on the header toggle button's position.
  await ar.addInitScript(() => localStorage.setItem('dahab_os_lang', 'ar'));
  const pageAr = await ar.newPage();
  if (!(await setupTraveler(ar))) {
    issue('high', 'setup', 'could not register AR traveler / create trip');
  } else {
    await pageAr.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
    await pageAr.waitForSelector('html[dir="rtl"]', { timeout: 8000 });
    await openSpontaneous(pageAr);
    await pageAr.screenshot({ path: 'tests/browser-qa/screenshots/what-should-i-do-now/ar-live.png', fullPage: true });
    const hasAr = (await pageAr.getByText(LIVE_AR).count()) > 0;
    const rtl = (await pageAr.locator('html').getAttribute('dir')) === 'rtl';
    console.log(`  arabicTitle=${hasAr} dir=${rtl ? 'rtl' : 'ltr'}`);
    if (!hasAr) issue('high', 'live-ar', 'Arabic mapped title did not render');
    if (!rtl) issue('high', 'live-ar', 'document did not flip to RTL');
  }
  await ar.close();

  // ── Fallback mode (stubbed 500) ─────────────────────────────────────────
  console.log('\n━━━ Fallback mode (500 stub) ━━━');
  const fb = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const pageFb = await fb.newPage();
  await pageFb.route('**/api/context/fit-window*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'stubbed 500 for QA' }) })
  );
  if (!(await setupTraveler(fb))) {
    issue('high', 'setup', 'could not register fallback traveler / create trip');
  } else {
    await openSpontaneous(pageFb);
    await pageFb.screenshot({ path: 'tests/browser-qa/screenshots/what-should-i-do-now/fallback-500.png', fullPage: true });
    const hasFallback = (await pageFb.getByText(FALLBACK).count()) > 0;
    const leakedLive = (await pageFb.getByText(LIVE_EN).count()) > 0;
    console.log(`  fallbackPresent=${hasFallback} liveLeaked=${leakedLive}`);
    if (!hasFallback) issue('high', 'fallback', 'formatted fallback did not render on 500');
    if (leakedLive) issue('high', 'fallback', 'live option leaked into 500 fallback');
  }
  await fb.close();

  await browser.close();

  console.log(`\n━━━ Summary: ${ISSUES.length} issue(s) ━━━`);
  if (ISSUES.length === 0) {
    console.log('  ✅ WhatShouldIDoNowView verified in EN, AR, and 500-fallback.');
  } else {
    ISSUES.forEach((i) => console.log(`  ${i.sev.toUpperCase()}: ${i.area} — ${i.desc}`));
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});