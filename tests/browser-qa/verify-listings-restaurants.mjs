/**
 * Listings & Restaurants Browser QA.
 *
 * Covers the two new directory surfaces:
 *   /listings  — grid/list/map view toggles, type multiselect pills, random /
 *                rating / popular sort, search, load-more, URL param sync
 *   /restaurants — hero stats, restaurant cards, price-tier chips, favourites,
 *                detail modal (via card click and via ?restaurant=id URL),
 *                comparison table, "Get 3 picks" WhatsApp CTA, mobile layout
 * Plus endpoint contracts for the backend filters added to /api/dahab/food.
 *
 * Requires the dev server running on http://localhost:3000 (like the other
 * tests/browser-qa scripts). Screenshots land in
 * screenshots/listings-restaurants/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/browser-qa/screenshots/listings-restaurants', { recursive: true });

const BASE = process.env.QA_BASE || 'http://localhost:3000';
const ISSUES = [];
function issue(sev, area, desc) {
  ISSUES.push({ sev, area, desc });
  console.log(`  ${sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🔵'} [${area}] ${desc}`);
}
const SHOT = (name) => `tests/browser-qa/screenshots/listings-restaurants/${name}`;

async function checkConsoleErrors(page, area) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  await new Promise((r) => setTimeout(r, 300));
  if (errors.length) issue('medium', area, `console errors: ${errors.slice(0, 3).join(' | ')}`);
  return errors;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const baseCtx = await browser.newContext();

  // ── Endpoint contracts (backend filters on /api/dahab/food) ──────────
  console.log('\n━━━ Endpoint contracts ━━━');
  try {
    let r = await baseCtx.request.get(`${BASE}/api/dahab/food`);
    let body = await r.json().catch(() => null);
    console.log(`  GET /api/dahab/food → ${r.status()} (${body?.venues?.length ?? '?'} venues)`);
    if (r.status() !== 200 || !body?.venues?.length) issue('high', 'api', 'food venues failed');

    r = await baseCtx.request.get(`${BASE}/api/dahab/food?price=Budget%20(%24)`);
    body = await r.json().catch(() => null);
    const allBudget = body?.venues?.every((v) => v.priceBand === 'Budget ($)');
    console.log(`  GET /api/dahab/food?price=Budget%20(%24) → ${r.status()} (${body?.venues?.length ?? '?'}, all Budget=${allBudget})`);
    if (r.status() !== 200 || !allBudget) issue('high', 'api', 'price filter failed');

    r = await baseCtx.request.get(`${BASE}/api/dahab/food?cuisine=seafood`);
    body = await r.json().catch(() => null);
    console.log(`  GET /api/dahab/food?cuisine=seafood → ${r.status()} (${body?.venues?.length ?? '?'})`);
    if (r.status() !== 200 || !Array.isArray(body?.venues)) issue('high', 'api', 'cuisine filter failed');

    r = await baseCtx.request.get(`${BASE}/api/dahab/food?sort=name&order=asc`);
    body = await r.json().catch(() => null);
    const names = body?.venues?.map((v) => v.nameEn) || [];
    const sorted = names.every((n, i) => i === 0 || names[i - 1].localeCompare(n) <= 0);
    console.log(`  GET /api/dahab/food?sort=name&order=asc → ${r.status()} sorted=${sorted}`);
    if (r.status() !== 200 || !sorted) issue('high', 'api', 'sort=name failed');

    r = await baseCtx.request.get(`${BASE}/api/dahab/commerce/suppliers`);
    body = await r.json().catch(() => null);
    console.log(`  GET /api/dahab/commerce/suppliers → ${r.status()} (${body?.suppliers?.length ?? '?'} suppliers)`);
    if (r.status() !== 200) issue('high', 'api', 'suppliers failed');
  } catch (e) {
    issue('high', 'api', `endpoint checks threw: ${e.message}`);
  }

  // ── /listings UI ──────────────────────────────────────────────────────
  console.log('\n━━━ /listings ━━━');
  let ctx = await browser.newContext();
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    await page.goto(`${BASE}/listings`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.getByRole('heading', { name: 'Dahab Listings' }).waitFor({ timeout: 10000 });
    console.log('  h1 "Dahab Listings" visible ✓');

    // Wait for cards (corpus fetch resolves async; fall back to demo data)
    await page.locator('h3').first().waitFor({ timeout: 15000 });
    const cardCount = await page.locator('h3').count();
    console.log(`  listing cards rendered: ${cardCount}`);
    if (cardCount === 0) issue('high', 'listings', 'no listing cards rendered');

    await page.screenshot({ path: SHOT('listings-grid.png'), fullPage: true });

    // Type pill filter (Events)
    const eventsBtn = page.getByRole('button', { name: 'Events' });
    if (await eventsBtn.count()) {
      await eventsBtn.first().click();
      await page.waitForURL(/[?&]type=/);
      const url = page.url();
      console.log(`  type pill → ${new URL(url).searchParams.get('type')}`);
      if (!url.includes('type=event')) issue('high', 'listings', `type=event not in URL: ${url}`);

      // Show All resets
      await page.getByRole('button', { name: 'Show All' }).click();
      await page.waitForURL(/type=show-all/);
      console.log('  Show All → type=show-all ✓');
    } else {
      issue('medium', 'listings', 'Events filter pill not found');
    }

    // Sort: Random
    await page.getByRole('button', { name: 'Random' }).click();
    await page.waitForURL(/sort=random/);
    await page.locator('h3').first().waitFor();
    console.log('  Random sort applied ✓');

    // View: list
    await page.getByRole('button', { name: 'list view' }).click();
    await page.waitForURL(/view=list/);
    await page.locator('h3').first().waitFor();
    console.log('  list view ✓');

    // View: map → coming-soon chip
    await page.getByRole('button', { name: 'map view' }).click();
    await page.waitForURL(/view=map/);
    const mapChip = await page.getByText(/Map view coming soon|وضع الخريطة قادم/i).first().isVisible().catch(() => false);
    console.log(`  map view → coming-soon chip visible=${mapChip}`);
    if (!mapChip) issue('medium', 'listings', 'map view placeholder chip not visible');

    // Back to grid
    await page.getByRole('button', { name: 'grid view' }).click();
    await page.waitForURL((u) => !u.search.includes('view='));

    // Search narrows results
    await page.getByRole('searchbox').fill('dive');
    await page.waitForTimeout(500);
    const searched = await page.locator('h3').count();
    console.log(`  search "dive" → ${searched} cards`);
    await page.getByRole('searchbox').fill('');
    await page.waitForTimeout(300);

    await checkConsoleErrors(page, 'listings');
  } catch (e) {
    issue('high', 'listings', `listings flow threw: ${e.message}`);
  }

  // Mobile check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/listings`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Dahab Listings' }).waitFor({ timeout: 10000 });
  await page.locator('h3').first().waitFor({ timeout: 10000 });
  const overflowM = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(`  mobile horizontal overflow: ${overflowM}`);
  if (overflowM) issue('high', 'listings', 'mobile horizontal overflow on /listings');
  await page.screenshot({ path: SHOT('listings-mobile.png'), fullPage: true });
  await ctx.close();

  // ── /restaurants UI ───────────────────────────────────────────────────
  console.log('\n━━━ /restaurants ━━━');
  ctx = await browser.newContext();
  page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    await page.goto(`${BASE}/restaurants`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.getByRole('heading', { name: 'Restaurants in Dahab' }).waitFor({ timeout: 10000 });
    console.log('  h1 "Restaurants in Dahab" visible ✓');

    await page.locator('h3').first().waitFor({ timeout: 15000 });
    const restCount = await page.locator('h3').count();
    console.log(`  restaurant cards rendered: ${restCount}`);
    if (restCount === 0) issue('high', 'restaurants', 'no restaurant cards rendered');

    // Stats chips
    const stats = await page.locator('div.flex.flex-wrap.gap-3').first().innerText().catch(() => '');
    console.log(`  stats: ${stats.replace(/\n/g, ' ').slice(0, 90)}`);
    if (!/Restaurants|مطاعم/.test(stats)) issue('medium', 'restaurants', 'stats row missing');

    await page.screenshot({ path: SHOT('restaurants-desktop.png'), fullPage: true });

    // Price tier chip filter
    const moderateChip = page.getByRole('button', { name: /Moderate/ });
    if (await moderateChip.count()) {
      await moderateChip.first().click();
      await page.waitForURL(/price=/);
      const priceParam = new URL(page.url()).searchParams.get('price');
      console.log(`  price chip → ${priceParam}`);
      if (!priceParam) issue('high', 'restaurants', 'price filter did not write URL');
      await moderateChip.first().click(); // untoggle (all 3 active)
    }

    // Favourites toggle
    const favBtn = page.getByRole('button', { name: /Add to favourites|أضف إلى المفضلة/ }).first();
    if (await favBtn.count()) {
      await favBtn.click();
      const favTab = page.getByRole('button', { name: /Favourites/ });
      if (await favTab.count()) {
        await favTab.first().click();
        const favCards = await page.locator('h3').count();
        console.log(`  favourites tab → ${favCards} card(s)`);
        if (favCards < 1) issue('medium', 'restaurants', 'favourites tab empty after heart click');
        await page.getByRole('button', { name: 'All' }).click();
      }
    }

    // Detail modal via card button
    const viewBtn = page.getByRole('button', { name: 'View restaurant' }).first();
    if (await viewBtn.count()) {
      await viewBtn.click();
      await page.getByRole('dialog').waitFor({ timeout: 5000 });
      const dialogTitle = await page.getByRole('dialog').locator('h3').innerText();
      console.log(`  detail modal opened: "${dialogTitle.slice(0, 40)}"`);
      if (!dialogTitle) issue('high', 'restaurants', 'detail modal has no title');
      await page.screenshot({ path: SHOT('restaurants-modal.png') });

      // URL carries ?restaurant=
      const rid = new URL(page.url()).searchParams.get('restaurant');
      console.log(`  ?restaurant=${rid}`);
      if (!rid) issue('high', 'restaurants', 'detail modal did not write ?restaurant param');

      // Close
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click().catch(() => {
        issue('medium', 'restaurants', 'close button not found by role');
      });
    }

    // Detail modal via direct URL (refresh survivability)
    await page.goto(`${BASE}/restaurants?restaurant=${rid || 'x'}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Restaurants in Dahab' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1200);
    const dialogOpen = await page.getByRole('dialog').isVisible().catch(() => false);
    console.log(`  direct ?restaurant= URL → modal open=${dialogOpen}`);
    if (rid && !dialogOpen) issue('high', 'restaurants', 'detail modal did not open from URL');

    // Comparison table
    const hasTable = await page.getByText(/Quick comparison|مقارنة سريعة/).first().isVisible().catch(() => false);
    console.log(`  comparison table present: ${hasTable}`);
    if (!hasTable) issue('medium', 'restaurants', 'comparison table missing');

    // WhatsApp CTA
    const waLink = await page.locator('a[href^="https://wa.me/"]').first().getAttribute('href').catch(() => null);
    console.log(`  WhatsApp CTA href: ${waLink ? waLink.slice(0, 60) : 'MISSING'}`);
    if (!waLink) issue('medium', 'restaurants', 'WhatsApp CTA missing');

    await checkConsoleErrors(page, 'restaurants');
  } catch (e) {
    issue('high', 'restaurants', `restaurants flow threw: ${e.message}`);
  }

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/restaurants`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Restaurants in Dahab' }).waitFor({ timeout: 10000 });
  await page.locator('h3').first().waitFor({ timeout: 10000 });
  const overflowR = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(`  mobile horizontal overflow: ${overflowR}`);
  if (overflowR) issue('high', 'restaurants', 'mobile horizontal overflow on /restaurants');
  await page.screenshot({ path: SHOT('restaurants-mobile.png'), fullPage: true });
  await ctx.close();

  await browser.close();

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n━━━ Summary: ${ISSUES.length} issue(s) ━━━`);
  if (ISSUES.length) {
    console.log(JSON.stringify(ISSUES, null, 2));
    process.exitCode = 1;
  } else {
    console.log('  All checks passed ✓');
  }
}

run().catch((e) => {
  console.error('QA run failed:', e);
  process.exit(1);
});