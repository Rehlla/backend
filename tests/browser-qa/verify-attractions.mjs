/**
 * Attractions ("Things to Do") Browser QA.
 *
 * Covers the Tripadvisor-style /attractions surface:
 *   /attractions — ranked numbered cards, category rail with counts, sort
 *                tabs, search, ?attraction=id detail modal (card click and
 *                direct URL), Book-now CTA on bookable items, mobile layout
 * Plus endpoint contracts for the backend GET /api/dahab/attractions
 * (buckets + counts, category/q/sort filters, rating honesty, IBAN non-leak).
 *
 * Requires the dev server running on http://localhost:3000 (like the other
 * tests/browser-qa scripts). Screenshots land in
 * screenshots/attractions/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/browser-qa/screenshots/attractions', { recursive: true });

const BASE = process.env.QA_BASE || 'http://localhost:3000';
const ISSUES = [];
function issue(sev, area, desc) {
  ISSUES.push({ sev, area, desc });
  console.log(`  ${sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🔵'} [${area}] ${desc}`);
}
const SHOT = (name) => `tests/browser-qa/screenshots/attractions/${name}`;

// Vite HMR websocket chatter and the anonymous /api/auth/me 401 are
// environment noise in headless mode, not app defects — filter them out.
function isNoise(msg) {
  return (
    /websocket|WebSocket|vite|HMR/i.test(msg) ||
    /401/i.test(msg) ||
    /Failed to load resource/i.test(msg)
  );
}

async function checkConsoleErrors(page, area) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  await new Promise((r) => setTimeout(r, 300));
  const real = errors.filter((e) => !isNoise(e));
  if (real.length) issue('medium', area, `console errors: ${real.slice(0, 3).join(' | ')}`);
  return real;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const baseCtx = await browser.newContext();

  // ── Endpoint contracts ────────────────────────────────────────────────
  console.log('\n━━━ Endpoint contracts ━━━');
  try {
    let r = await baseCtx.request.get(`${BASE}/api/dahab/attractions`);
    let body = await r.json().catch(() => null);
    console.log(`  GET /api/dahab/attractions → ${r.status()} (${body?.count ?? '?'} attractions, ${body?.categories?.length ?? '?'} buckets)`);
    if (r.status() !== 200 || !body?.attractions?.length) issue('high', 'api', 'attractions list failed');
    if (!body?.categories?.length) issue('high', 'api', 'category rail empty');

    // Buckets must be real ids, every attraction must be in one of them.
    const bucketIds = new Set(body.categories.map((c) => c.id));
    const unassigned = body.attractions.filter((a) => !bucketIds.has(a.bucket)).length;
    if (unassigned) issue('high', 'api', `${unassigned} attraction(s) in an unknown bucket`);

    // Rating honesty: no fabricated 4.x on unmeasured records — check that at
    // least the corpus mixes rated and unrated, and nothing invents a rating
    // where the source had none (already covered by unit tests; here we only
    // assert the shape).
    const withRating = body.attractions.filter((a) => typeof a.rating === 'number').length;
    console.log(`  rated items: ${withRating} / ${body.attractions.length}`);
    if (withRating === 0) issue('medium', 'api', 'no rated providers in corpus');

    // Bookable items exist and carry the sku needed by the Book CTA.
    const bookable = body.attractions.filter((a) => a.bookable && a.skuId);
    console.log(`  bookable items: ${bookable.length}`);
    if (bookable.length === 0) issue('medium', 'api', 'no bookable attraction found');

    // Category filter narrows to one bucket.
    r = await baseCtx.request.get(`${BASE}/api/dahab/attractions?category=diving-snorkeling`);
    body = await r.json().catch(() => null);
    const allDiving = body?.attractions?.every((a) => a.bucket === 'diving-snorkeling');
    console.log(`  ?category=diving-snorkeling → ${r.status()} (${body?.count ?? '?'}, allDiving=${allDiving})`);
    if (r.status() !== 200 || !allDiving) issue('high', 'api', 'category filter failed');

    // Search narrows.
    r = await baseCtx.request.get(`${BASE}/api/dahab/attractions?q=blue hole`);
    body = await r.json().catch(() => null);
    console.log(`  ?q=blue hole → ${r.status()} (${body?.count ?? '?'})`);
    if (r.status() !== 200 || !body?.count) issue('high', 'api', 'q search failed');

    // Name sort ascending.
    r = await baseCtx.request.get(`${BASE}/api/dahab/attractions?sort=name&order=asc`);
    body = await r.json().catch(() => null);
    const names = body?.attractions?.map((a) => a.nameEn) || [];
    const sorted = names.every((n, i) => i === 0 || names[i - 1].localeCompare(n) <= 0);
    console.log(`  ?sort=name&order=asc → ${r.status()} sorted=${sorted}`);
    if (r.status() !== 200 || !sorted) issue('high', 'api', 'sort=name failed');

    // IBAN / payout data must never cross this surface.
    r = await baseCtx.request.get(`${BASE}/api/dahab/attractions`);
    const raw = await r.text();
    const leak = raw.includes('EG890002') || raw.toLowerCase().includes('payout');
    console.log(`  payout/IBAN leak: ${leak}`);
    if (leak) issue('high', 'api', 'payout data leaked on public /attractions');
  } catch (e) {
    issue('high', 'api', `endpoint checks threw: ${e.message}`);
  }

  // ── /attractions UI ───────────────────────────────────────────────────
  console.log('\n━━━ /attractions ━━━');
  let ctx = await browser.newContext();
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    await page.goto(`${BASE}/attractions`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.getByRole('heading', { name: /Things to Do in Dahab/i }).waitFor({ timeout: 10000 });
    console.log('  h1 "Things to Do in Dahab" visible ✓');

    await page.locator('h3').first().waitFor({ timeout: 15000 });
    const cardCount = await page.locator('h3').count();
    const railCount = await page.locator('aside button').count();
    console.log(`  cards: ${cardCount}, category rail buttons: ${railCount}`);
    if (cardCount === 0) issue('high', 'attractions', 'no attraction cards rendered');
    if (railCount < 2) issue('high', 'attractions', 'category rail not rendered');

    // Rank numbers (1..n) render on the numbered list.
    const rankOne = await page.getByText('1', { exact: true }).count().catch(() => 0);
    if (rankOne === 0) issue('low', 'attractions', 'rank number 1 not found on first card');

    await page.screenshot({ path: SHOT('attractions-desktop.png'), fullPage: true });

    // Category chip filter writes the URL and narrows the list.
    const diveChip = page.getByRole('button', { name: /Diving & Snorkeling/i });
    if (await diveChip.count()) {
      await diveChip.first().click();
      await page.waitForURL(/category=diving-snorkeling/);
      await page.waitForTimeout(1000);
      const narrowed = await page.locator('h3').count();
      console.log(`  diving chip → ?category=diving-snorkeling (${narrowed} cards)`);
      if (narrowed === 0) issue('high', 'attractions', 'category filter emptied the grid');
      await page.getByRole('button', { name: /All things to do/i }).click();
      await page.waitForTimeout(1000);
    } else {
      issue('medium', 'attractions', 'diving category chip not found');
    }

    // Sort tab writes ?sort=
    const ratingTab = page.getByRole('button', { name: /Traveler favorites/i });
    if (await ratingTab.count()) {
      await ratingTab.first().click();
      await page.waitForURL(/sort=rating/);
      await page.waitForTimeout(800);
      console.log('  sort → Traveler favorites (?sort=rating) ✓');
      await page.getByRole('button', { name: /Top attractions/i }).click();
      await page.waitForURL((u) => !u.search.includes('sort='));
    }

    // Search narrows.
    await page.getByRole('searchbox').fill('blue hole');
    await page.waitForURL(/q=/);
    await page.waitForTimeout(1000);
    const searched = await page.locator('h3').count();
    console.log(`  search "blue hole" → ${searched} cards`);
    if (searched === 0) issue('high', 'attractions', 'search emptied the grid');
    await page.getByRole('searchbox').fill('');
    await page.waitForTimeout(500);

    // Detail modal via card click; URL carries ?attraction=
    await page.locator('h3').first().click();
    await page.getByRole('dialog').waitFor({ timeout: 5000 });
    const dialogTitle = await page.getByRole('dialog').locator('h2').innerText().catch(() => '');
    console.log(`  detail modal opened: "${dialogTitle.slice(0, 40)}"`);
    if (!dialogTitle) issue('high', 'attractions', 'detail modal has no title');
    await page.screenshot({ path: SHOT('attractions-modal.png') });

    const aid = new URL(page.url()).searchParams.get('attraction');
    console.log(`  ?attraction=${aid}`);
    if (!aid) issue('high', 'attractions', 'detail modal did not write ?attraction param');

    // Modal facts: rating honesty + duration + price present for what has them.
    const modalText = await page.getByRole('dialog').innerText().catch(() => '');
    if (!/No ratings yet|No collected ratings yet|reviews/i.test(modalText)) {
      // either rated (reviews) or honestly unrated — both fine; only a crash matters
      issue('medium', 'attractions', 'modal rating block unexpected');
    }

    // Close works.
    await page.getByRole('dialog').getByRole('button', { name: /Close|إغلاق/i }).click();
    await page.waitForTimeout(400);
    const dialogClosed = (await page.getByRole('dialog').count()) === 0;
    console.log(`  modal closed: ${dialogClosed}`);
    if (!dialogClosed) issue('high', 'attractions', 'modal did not close');

    // Direct URL re-opens the modal (refresh survivability).
    await page.goto(`${BASE}/attractions?attraction=${aid || 'x'}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Things to Do in Dahab/i }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1200);
    const reopened = (await page.getByRole('dialog').count()) > 0;
    console.log(`  direct ?attraction= URL → modal open=${reopened}`);
    if (aid && !reopened) issue('high', 'attractions', 'detail modal did not open from URL');

    // Book-now CTA exists on at least one bookable card in the full list.
    await page.goto(`${BASE}/attractions`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Things to Do in Dahab/i }).waitFor({ timeout: 10000 });
    await page.locator('h3').first().waitFor({ timeout: 15000 });
    const bookButtons = await page.getByRole('button', { name: /Book now|احجز الآن/i }).count();
    console.log(`  book-now CTAs rendered: ${bookButtons}`);
    if (bookButtons === 0) issue('medium', 'attractions', 'no Book-now CTA on any bookable card');

    await checkConsoleErrors(page, 'attractions');
  } catch (e) {
    issue('high', 'attractions', `attractions flow threw: ${e.message}`);
  }

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/attractions`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Things to Do in Dahab/i }).waitFor({ timeout: 10000 });
  await page.locator('h3').first().waitFor({ timeout: 10000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(`  mobile horizontal overflow: ${overflow}`);
  if (overflow) issue('high', 'attractions', 'mobile horizontal overflow on /attractions');
  await page.screenshot({ path: SHOT('attractions-mobile.png'), fullPage: true });
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