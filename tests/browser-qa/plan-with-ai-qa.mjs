/**
 * Plan with AI — Browser QA.
 *
 * Covers the homepage planning chat + its persistence:
 *   - endpoint contracts: POST /api/trip/generate is public; POST
 *     /api/trip/apply-ai is 401 without a session
 *   - full persist round trip: register → generate → apply-ai (201, items
 *     written) → trips list contains it → second apply upgrades the same trip
 *     (replaces suggestions, no duplicate trips)
 *   - desktop UI (anonymous): widget renders on the home hero, an example chip
 *     produces a day-by-day plan, refine re-rolls it, collapse hides it
 *   - quick-answer path: "where should I stay in Dahab?" answers and deep
 *     links to /hotels
 *   - signed-in save flow: chip → plan → "Save this plan to My Trip" lands on
 *     /my-trip and the plan is queryable from the API
 *   - mobile 390px: widget visible, no horizontal overflow
 *
 * Requires the dev server already running on http://localhost:3000 (like the
 * other tests/browser-qa scripts). Screenshots land in
 * screenshots/plan-with-ai/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/browser-qa/screenshots/plan-with-ai', { recursive: true });

const BASE = process.env.QA_BASE || 'http://localhost:3000';
// Cookies are scoped to the exact host the QA runs against — 127.0.0.1 on
// machines where 'localhost' resolves to IPv6 while the server binds IPv4.
const COOKIE_DOMAIN = new URL(BASE).hostname;
const ISSUES = [];
function issue(sev, area, desc) {
  ISSUES.push({ sev, area, desc });
  console.log(`  ${sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🔵'} [${area}] ${desc}`);
}

async function registerUser(ctx) {
  const email = `pwa-${Date.now()}@dahab.travel`;
  const res = await ctx.request.post(`${BASE}/api/auth/register`, {
    data: { name: 'Plan with AI QA', email, password: 'QA2026!', role: 'Traveler' }
  });
  const h = res.headers()['set-cookie'] || '';
  const m = h.match(/dahab_auth_token=([^;]+)/);
  if (m) {
    await ctx.addCookies([{ name: 'dahab_auth_token', value: m[1], domain: COOKIE_DOMAIN, path: '/' }]);
    return email;
  }
  return null;
}

const SAMPLE_ITINERARY = {
  tripTitle: '4-Day QA Dahab Plan',
  days: [
    {
      dayNumber: 1,
      activities: [
        { title: 'Guided Morning Dive at The Canyon', timeSlot: '09:00 AM', category: 'diving', estimatedPriceEGP: 1350, location: 'The Canyon' },
        { title: 'Seaside Fresh Catch Lunch', timeSlot: '01:30 PM', category: 'food', estimatedPriceEGP: 450, location: 'Eel Garden' }
      ]
    },
    {
      dayNumber: 2,
      activities: [
        { title: 'Coloured Canyon Jeep Safari', timeSlot: '08:00 AM', category: 'safari', estimatedPriceEGP: 900, location: 'Coloured Canyon' },
        { title: 'Sunset on the Lighthouse Promenade', timeSlot: '05:30 PM', category: 'relax', estimatedPriceEGP: 0 }
      ]
    }
  ]
};

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ── Endpoint contracts ──────────────────────────────────────────────────
  console.log('\n━━━ Endpoint contracts ━━━');
  const anon = await browser.newContext();
  let r = await anon.request.post(`${BASE}/api/trip/generate`, { data: { durationDays: 4, interests: ['Diving'] }, timeout: 120000 });
  let gen = await r.json().catch(() => null);
  console.log(`  POST /api/trip/generate (anonymous) → ${r.status()} (${gen?.trip?.days?.length ?? '?'} days)`);
  if (r.status() !== 200 || !gen?.trip?.days?.length) issue('high', 'api', 'public generate failed');

  r = await anon.request.post(`${BASE}/api/trip/apply-ai`, { data: { itinerary: SAMPLE_ITINERARY } });
  console.log(`  POST /api/trip/apply-ai (anonymous) → ${r.status()} (expected 401)`);
  if (r.status() !== 401) issue('high', 'api', 'apply-ai must require a session');
  await anon.close();

  // ── Full persist round trip (registered traveler) ───────────────────────
  console.log('\n━━━ Persist round trip (registered user) ━━━');
  const auth = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const email = await registerUser(auth);
  if (!email) {
    issue('high', 'api', 'could not register QA traveler');
  } else {
    r = await auth.request.post(`${BASE}/api/trip/generate`, { data: { durationDays: 4, interests: ['Diving', 'Adventure'] }, timeout: 120000 });
    gen = await r.json().catch(() => null);
    console.log(`  generate (authed) → ${r.status()}`);

    r = await auth.request.post(`${BASE}/api/trip/apply-ai`, {
      data: { itinerary: SAMPLE_ITINERARY, lengthDays: 4, travelersCount: 2, budget: 'Moderate', pace: 'Balanced', interests: ['Diving', 'Adventure'] }
    });
    const saved = await r.json().catch(() => null);
    console.log(`  apply-ai #1 → ${r.status()} items=${saved?.itemCount} trip=${saved?.trip?.id}`);
    if (r.status() !== 201 || !saved?.itemCount || !saved?.trip?.id) issue('high', 'api', 'apply-ai #1 failed');
    const firstTripId = saved?.trip?.id;

    if (firstTripId) {
      const detail = await (await auth.request.get(`${BASE}/api/trips/${firstTripId}`)).json();
      const expectedRows = SAMPLE_ITINERARY.days.flatMap(d => d.activities).length;
      console.log(`  trip items in store → ${detail?.items?.length ?? '?'} (expected ${expectedRows})`);
      if ((detail?.items || []).length !== expectedRows) issue('high', 'api', `expected ${expectedRows} stored items, got ${detail?.items?.length}`);
      const priced = (detail?.items || []).reduce((s, i) => s + (i.priceEGP || 0), 0);
      console.log(`  server-recomputed total → ${priced} EGP (expected 2700)`);
      if (priced !== 2700) issue('high', 'api', `expected total 2700, got ${priced}`);

      // Second save replaces suggestions on the SAME trip (no duplicates).
      r = await auth.request.post(`${BASE}/api/trip/apply-ai`, {
        data: { itinerary: SAMPLE_ITINERARY, lengthDays: 4, travelersCount: 2, budget: 'Premium', pace: 'Active', interests: ['Food'] }
      });
      const saved2 = await r.json().catch(() => null);
      console.log(`  apply-ai #2 → ${r.status()} sameTrip=${saved2?.trip?.id === firstTripId}`);
      if (saved2?.trip?.id !== firstTripId) issue('high', 'api', 'second save created a duplicate trip');
      const detail2 = await (await auth.request.get(`${BASE}/api/trips/${firstTripId}`)).json();
      if ((detail2?.items || []).length !== expectedRows) issue('high', 'api', 'items not replaced cleanly after second save');
      const status2 = await (await auth.request.get(`${BASE}/api/trips/${firstTripId}`)).json();
      console.log(`  upgraded trip status/pace → ${status2?.trip?.status} / ${status2?.trip?.pace}`);
    }
  }

  // ── Desktop UI (anonymous) — plan flow ──────────────────────────────────
  console.log('\n━━━ Desktop 1440px — anonymous planning chat ━━━');
  const anonPage = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await anonPage.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(1500);

  const widget = page.locator('section[aria-label="Plan with AI"]');
  if (!(await widget.count())) {
    issue('high', 'widget', 'Plan with AI section not on the homepage');
  } else {
    console.log('  ✅ Widget section present');
    const chip = page.locator('button', { hasText: '4 days, first-timers' }).first();
    if (await chip.count()) {
      await chip.click();
      console.log('  Chip clicked — waiting for a generated plan…');
      try {
        await page.locator('text=Day 1').first().waitFor({ state: 'visible', timeout: 120000 });
        const dayCount = await page.locator('text=/^Day \\d+$/').count();
        console.log(`  ✅ Plan rendered with ${dayCount} day heading(s)`);
        const body = await page.locator('body').innerText();
        if (!/EGP|تومان|جنية|جنيه/.test(body)) issue('low', 'widget', 'no price hints in the rendered plan');
        await page.screenshot({ path: 'tests/browser-qa/screenshots/plan-with-ai/desktop-plan.png' });
      } catch {
        issue('high', 'widget', 'plan never rendered after chip click (Day 1 never visible)');
      }

      // Refine re-rolls the plan.
      const tweak = page.locator('button', { hasText: 'Tighter budget' }).first();
      if (await tweak.count()) {
        await tweak.click();
        try {
          await page.locator('text=Day 1').first().waitFor({ state: 'visible', timeout: 120000 });
          console.log('  ✅ "Tighter budget" re-rolled the plan');
        } catch {
          issue('medium', 'widget', 'plan did not reappear after refine');
        }
      } else {
        issue('medium', 'widget', '"Tighter budget" chip missing from plan view');
      }

      // Signed-out gate CTA.
      const gate = page.locator('button', { hasText: 'Sign in to save this plan' }).first();
      if (await gate.count()) {
        await gate.click();
        await page.waitForTimeout(1200);
        console.log(`  Signed-out save CTA → ${page.url().includes('/auth/sign-in') ? 'auth page ✅' : page.url()}`);
        if (!page.url().includes('/auth/sign-in')) issue('medium', 'widget', 'save CTA did not reach sign-in');
      } else {
        issue('medium', 'widget', 'sign-in save CTA missing for anonymous user');
      }
    } else {
      issue('high', 'widget', 'example chip not found');
    }
  }
  await anonPage.close();

  // ── Quick answer + deep link ────────────────────────────────────────────
  console.log('\n━━━ Quick answer — "where should I stay?" ━━━');
  const qaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const qaPage = await qaCtx.newPage();
  await qaPage.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await qaPage.waitForTimeout(1200);
  const input = qaPage.locator('#plan-with-ai-input');
  if (await input.count()) {
    await input.fill('where should I stay in Dahab?');
    await input.press('Enter');
    try {
      await qaPage.locator('button', { hasText: 'Browse stays' }).first().waitFor({ state: 'visible', timeout: 15000 });
      console.log('  ✅ Answer rendered with hotels deep link');
      await qaPage.screenshot({ path: 'tests/browser-qa/screenshots/plan-with-ai/quick-answer.png' });
      await qaPage.locator('button', { hasText: 'Browse stays' }).first().click();
      await qaPage.waitForURL('**/hotels', { timeout: 15000 }).catch(() => null);
      console.log(`  Deep link → ${qaPage.url().includes('/hotels') ? '/hotels ✅' : qaPage.url()}`);
      if (!qaPage.url().includes('/hotels')) issue('medium', 'widget', 'answer deep link missed /hotels');
    } catch {
      issue('medium', 'widget', 'quick answer did not render');
    }
  } else {
    issue('high', 'widget', 'composer #plan-with-ai-input missing');
  }
  await qaCtx.close();

  // ── Collapse / expand ───────────────────────────────────────────────────
  console.log('\n━━━ Collapse / expand ━━━');
  const colCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const colPage = await colCtx.newPage();
  await colPage.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await colPage.waitForTimeout(1200);
  const toggle = colPage.locator('button[aria-expanded="true"]').first();
  if (await toggle.count()) {
    await toggle.click();
    await colPage.waitForTimeout(400);
    const hidden = (await colPage.locator('#plan-with-ai-input').count()) === 0;
    console.log(`  Collapsed hides composer: ${hidden}`);
    if (!hidden) issue('medium', 'widget', 'collapse did not hide the composer');
    const reopen = colPage.locator('button[aria-expanded="false"]').first();
    await reopen.click();
    await colPage.waitForTimeout(400);
    console.log(`  Reopen shows composer: ${(await colPage.locator('#plan-with-ai-input').count()) > 0}`);
  } else {
    issue('medium', 'widget', 'header toggle button not found');
  }
  await colCtx.close();

  // ── Mobile 390 ──────────────────────────────────────────────────────────
  console.log('\n━━━ Mobile 390px ━━━');
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await registerUser(mob);
  const pageM = await mob.newPage();
  await pageM.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await pageM.waitForTimeout(1500);
  if (await pageM.locator('section[aria-label="Plan with AI"]').count()) console.log('  ✅ Widget visible on mobile');
  else issue('high', 'widget', 'widget missing on mobile homepage');
  const overflow = await pageM.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }));
  if (overflow.doc > overflow.view + 2) issue('high', 'overflow', `mobile overflow ${overflow.doc}px > ${overflow.view}px`);
  else console.log(`  ✅ No mobile horizontal overflow (${overflow.doc}px)`);
  await pageM.screenshot({ path: 'tests/browser-qa/screenshots/plan-with-ai/mobile-widget.png' });

  // ── Signed-in save through the UI ───────────────────────────────────────
  console.log('\n━━━ Signed-in UI save → My Trip ━━━');
  await pageM.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await pageM.waitForTimeout(1200);
  const mChip = pageM.locator('button', { hasText: '4 days, first-timers' }).first();
  if (await mChip.count()) {
    await mChip.click();
    try {
      await pageM.locator('text=Day 1').first().waitFor({ state: 'visible', timeout: 120000 });
      const saveBtn = pageM.locator('button', { hasText: 'Save this plan to My Trip' }).first();
      if (await saveBtn.count()) {
        await saveBtn.click();
        await pageM.waitForURL('**/my-trip', { timeout: 20000 }).catch(() => null);
        console.log(`  After save → ${pageM.url().includes('/my-trip') ? '/my-trip ✅' : pageM.url()}`);
        if (!pageM.url().includes('/my-trip')) issue('high', 'ui-save', 'save did not land on /my-trip');
        await pageM.waitForTimeout(4000);
        const myTripBody = await pageM.locator('body').innerText().catch(() => '');
        if (/Day 1/.test(myTripBody)) console.log('  ✅ My Trip timeline shows the saved plan');
        else issue('medium', 'ui-save', 'saved plan days not visible on /my-trip');
        await pageM.screenshot({ path: 'tests/browser-qa/screenshots/plan-with-ai/my-trip-after-save.png' });
      } else {
        issue('high', 'ui-save', 'Save to My Trip button missing while signed in');
      }
    } catch {
      issue('high', 'ui-save', 'plan did not render for signed-in save flow');
    }
  } else {
    issue('high', 'ui-save', 'example chip missing on mobile home');
  }
  await mob.close();

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const high = ISSUES.filter(i => i.sev === 'high');
  const med = ISSUES.filter(i => i.sev === 'medium');
  console.log(`  Issues: 🔴 ${high.length} high, 🟡 ${med.length} medium`);

  await browser.close();
  if (high.length) process.exitCode = 1;
}

run().catch(err => {
  console.error('QA failed:', err);
  process.exit(1);
});
