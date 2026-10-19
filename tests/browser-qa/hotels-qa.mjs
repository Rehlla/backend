/**
 * Hotels Hub Browser QA.
 *
 * Covers the /hotels journey:
 *   - catalogue + detail endpoint contracts (public GETs, filters, availability)
 *   - list page: hero/stats chips, search, category/price/area chips, 13 cards
 *   - card -> detail navigation (URL carries the slug)
 *   - detail: price widget, availability check, WhatsApp concierge href
 *   - booking gate: signed-out book -> /auth/sign-in (no DB write)
 *   - signed-in book -> /book-now?skuId=SKU-HTL-...
 *   - header nav link (desktop) + mobile dock entry, no horizontal overflow
 *   - Arabic render (RTL, signatures)
 *
 * Requires a running server with current code. Screenshots land in
 * screenshots/hotels/. Usage: QA_BASE=http://localhost:3000 node
 * tests/browser-qa/hotels-qa.mjs  (BASE defaults to localhost:3000)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/browser-qa/screenshots/hotels', { recursive: true });

const BASE = process.env.QA_BASE || 'http://localhost:3000';
const ISSUES = [];
function issue(sev, area, desc) {
  ISSUES.push({ sev, area, desc });
  console.log(`  ${sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🔵'} [${area}] ${desc}`);
}

async function setupAuth(ctx, name) {
  const email = `tqa-${Date.now()}@dahab.travel`;
  const res = await ctx.request.post(`${BASE}/api/auth/register`, {
    data: { name: name || 'Hotels QA', email, password: 'QA2026!', role: 'Traveler' }
  });
  const h = res.headers()['set-cookie'];
  if (h) {
    const m = h.match(/dahab_auth_token=([^;]+)/);
    if (m) await ctx.addCookies([{ name: 'dahab_auth_token', value: m[1], domain: 'localhost', path: '/' }]);
  }
}

const plusDays = (n) => {
  const d = new Date(Date.now() + n * 864e5);
  return d.toISOString().split('T')[0];
};

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ── Endpoint contracts (no UI) ─────────────────────────────────────────
  console.log('\n━━━ Endpoint contracts ━━━');
  const ctx0 = await browser.newContext();
  let r = await ctx0.request.get(`${BASE}/api/hotels`);
  const catalogue = await r.json().catch(() => null);
  console.log(`  GET /api/hotels → ${r.status()} (${catalogue?.hotels?.length ?? '?'} hotels)`);
  if (r.status() !== 200 || !catalogue?.hotels?.length) issue('high', 'api', 'catalogue fetch failed');
  const cat = catalogue || { hotels: [], stats: {}, areas: [], disclaimer: '' };
  if (cat.stats?.total !== cat.hotels?.length) issue('high', 'api', `stats.total ${cat.stats?.total} != hotel count ${cat.hotels?.length}`);
  if (!cat.stats?.averageRating) issue('medium', 'api', 'stats.averageRating missing');
  if (!cat.stats?.totalReviews) issue('medium', 'api', 'stats.totalReviews missing');
  if (!cat.stats?.updatedLabel) issue('medium', 'api', 'stats.updatedLabel missing');
  if (!Array.isArray(cat.areas) || cat.areas.length < 1) issue('high', 'api', 'no area guide entries');
  if (!cat.disclaimer) issue('medium', 'api', 'disclaimer missing');

  r = await ctx0.request.get(`${BASE}/api/hotels?category=resort`);
  const resorts = await r.json().catch(() => null);
  const resortCount = resorts?.hotels?.length ?? 0;
  console.log(`  GET /api/hotels?category=resort → ${r.status()} (${resortCount})`);
  if (r.status() !== 200 || resortCount === 0 || resortCount >= cat.hotels?.length) issue('high', 'api', 'category filter did not narrow the set');

  r = await ctx0.request.get(`${BASE}/api/hotels?priceBand=premium`);
  const premium = await r.json().catch(() => null);
  console.log(`  GET /api/hotels?priceBand=premium → ${r.status()} (${premium?.hotels?.length ?? '?'})`);
  if (r.status() !== 200 || !premium?.hotels?.length) issue('high', 'api', 'priceBand filter failed');

  const first = cat.hotels[0];
  r = await ctx0.request.get(`${BASE}/api/hotels/${encodeURIComponent(first.slug)}`);
  const detail = await r.json().catch(() => null);
  console.log(`  GET /api/hotels/${first.slug} → ${r.status()} (hotel=${detail?.hotel?.id}, sku=${detail?.sku?.id}, supplier=${detail?.supplier?.businessName ?? 'none'})`);
  const detailOk = r.status() === 200 && detail?.hotel?.slug === first.slug && detail?.sku?.id && detail?.supplier?.businessName;
  if (!detailOk) issue('high', 'api', 'detail fetch missing hotel/sku/supplier');

  r = await ctx0.request.post(`${BASE}/api/commerce/availability`, {
    data: { serviceType: 'hotel', skuId: detail.sku.id, date: plusDays(30), timeSlot: 'Standard Check-in 14:00', passengers: 1 }
  });
  let avail;
  try { avail = await r.json(); } catch { avail = null; }
  console.log(`  POST /api/commerce/availability (hotel) → ${r.status()} (${avail?.available === true ? 'available' : avail?.available ?? 'null'})`);
  if (r.status() !== 200 || avail?.available !== true) issue('high', 'api', 'hotel availability check did not return available');
  await ctx0.close();

  // ── Desktop 1440 — catalogue list ─────────────────────────────────────
  console.log('\n━━━ Desktop 1440px — /hotels list ━━━');
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(ctxA, 'Hotels QA');
  const page = await ctxA.newPage();
  await page.goto(`${BASE}/hotels`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);

  const title = await page.textContent('h1').catch(() => null);
  console.log(`  h1: "${title}"`);
  if (!title || !/Hotels in Dahab/.test(title)) issue('high', 'list', `h1 wrong: ${title}`);

  const statsCount = Number(cat.stats.total);
  console.log(`  Stats chips: ${statsCount} hotels / ${cat.stats.averageRating.toFixed(1)}★ / ${cat.stats.totalReviews.toLocaleString()} / ${cat.stats.updatedLabel}`);
  const statText = await page.locator('body').innerText();
  if (!statText.includes(String(statsCount))) issue('high', 'list', `stats missing total ${statsCount}`);
  if (!statText.includes('4.6★')) issue('medium', 'list', 'stats avg rating missing (4.6★)');

  const viewBtns = await page.locator('button:has-text("View stay")').count();
  console.log(`  "View stay" buttons: ${viewBtns} (expected ${cat.hotels.length})`);
  if (viewBtns !== cat.hotels.length) issue('high', 'list', `expected ${cat.hotels.length} cards, got ${viewBtns}`);

  const catChips = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter(b => /^(budget|mid-range|boutique|resort)$/.test((b.textContent || '').trim()))
      .length);
  console.log(`  Category chips: ${catChips}`);
  if (catChips < 4) issue('high', 'list', `expected 4 category chips, got ${catChips}`);

  const priceChips = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter(b => /^(budget|moderate|premium)$/.test((b.textContent || '').trim()))
      .length);
  console.log(`  Price-band chips: ${priceChips}`);
  if (priceChips < 3) issue('high', 'list', `expected 3 price-band chips, got ${priceChips}`);

  const area0 = cat.areas[0];
  const areaChip = page.locator(`button:has-text("${area0.name}")`);
  console.log(`  Area chip "${area0.name}": ${await areaChip.count() > 0}`);
  if (await areaChip.count() === 0) issue('medium', 'list', `area chip ${area0.name} missing`);

  const searchBox = page.locator('input[type="search"]');
  console.log(`  Search input: ${await searchBox.count() > 0}`);
  if (await searchBox.count() === 0) issue('high', 'list', 'search input missing');

  if (!/Explore Dahab by area/.test(statText)) issue('medium', 'list', 'area guide section missing');
  if (!/Google reviews/.test(statText)) issue('medium', 'list', 'rating-source label missing');
  await page.screenshot({ path: 'tests/browser-qa/screenshots/hotels/desktop-list.png' });

  // ── Open first card → detail page ─────────────────────────────────────
  console.log('\n━━━ Desktop — card → detail ━━━');
  await page.locator('button:has-text("View stay")').first().click();
  await page.waitForTimeout(1500);
  const detailUrl = page.url();
  console.log(`  Detail URL: ${detailUrl.split('/').pop()}`);
  if (!/\/hotels\/[^/]+$/.test(detailUrl)) issue('high', 'detail', `expected /hotels/:slug, got ${detailUrl}`);

  const perNight = first.perNightEGP.toLocaleString('en-US');
  const dBody = await page.locator('body').innerText();
  if (!dBody.includes(`${perNight} EGP`)) issue('medium', 'detail', `per-night price ${perNight} EGP not shown`);
  if (!dBody.includes('5-night package')) issue('medium', 'detail', 'package label missing');
  if (!dBody.includes('Check availability')) issue('high', 'detail', 'Check availability button missing');
  if (!dBody.includes('Book this stay')) issue('high', 'detail', 'Book this stay button missing');

  const wa = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href*="wa.me"]'))[0];
    return a ? a.getAttribute('href') : null;
  });
  console.log(`  WhatsApp concierge href: ${wa}`);
  if (!wa || !wa.includes('wa.me/201002328005')) issue('high', 'detail', `WhatsApp href wrong: ${wa}`);
  if (!dBody.includes('Plan this stay with AskDayGI')) issue('medium', 'detail', 'concierge CTA text missing');
  await page.screenshot({ path: 'tests/browser-qa/screenshots/hotels/desktop-detail.png' });

  // ── In-widget availability check (signed in) ──────────────────────────
  const future = plusDays(30);
  const dateInput = page.locator('input[type="date"]');
  await dateInput.fill(future);
  await page.locator('button:has-text("Check availability")').click();
  await page.waitForTimeout(2500);
  const statusText = await page.locator('[role="status"]').first().textContent().catch(() => null);
  console.log(`  Availability status: ${statusText}`);
  if (!statusText || !/Available on .{10}/.test(statusText)) issue('high', 'detail', `availability open message missing: ${statusText}`);

  // ── Signed-in book → /book-now ────────────────────────────────────────
  await page.locator('button:has-text("Book this stay")').click();
  await page.waitForTimeout(2500);
  const bookUrl = page.url();
  console.log(`  Signed-in book → ${bookUrl.split('?')[1]}`);
  if (!bookUrl.includes('/book-now') || !bookUrl.includes('skuId=SKU-HTL-')) issue('high', 'detail', `book-now handoff failed: ${bookUrl}`);
  await page.screenshot({ path: 'tests/browser-qa/screenshots/hotels/desktop-book-now.png' });
  await ctxA.close();

  // ── Signed-OUT booking gate → /auth/sign-in (no DB write) ─────────────
  console.log('\n━━━ Booking gate (signed out) ━━━');
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageB = await ctxB.newPage();
  await pageB.goto(`${BASE}/hotels/${encodeURIComponent(first.slug)}`, { waitUntil: 'networkidle', timeout: 20000 });
  await pageB.waitForTimeout(1500);
  await pageB.locator('button:has-text("Book this stay")').click();
  await pageB.waitForTimeout(2000);
  const gateUrl = pageB.url();
  console.log(`  Signed-out book → ${gateUrl.split('/').pop()}`);
  if (!gateUrl.includes('/auth/sign-in')) issue('high', 'gate', `signed-out book did not redirect to sign-in: ${gateUrl}`);
  await pageB.screenshot({ path: 'tests/browser-qa/screenshots/hotels/signed-out-gate.png' });
  await ctxB.close();

  // ── Arabic render ─────────────────────────────────────────────────────
  console.log('\n━━━ Arabic render ━━━');
  const ctxC = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageC = await ctxC.newPage();
  await pageC.goto(`${BASE}/hotels`, { waitUntil: 'networkidle', timeout: 20000 });
  await pageC.waitForTimeout(1500);
  const langToggle = pageC.locator('button[aria-label="Switch to Arabic"]').first();
  if (await langToggle.count()) {
    await langToggle.click();
    await pageC.waitForTimeout(1500);
    const arBody = await pageC.locator('body').innerText();
    const rtl = await pageC.evaluate(() => !!document.querySelector('[dir="rtl"]'));
    console.log(`  RTL: ${rtl}, has "فنادق دهب": ${arBody.includes('فنادق دهب')}`);
    if (!rtl) issue('medium', 'i18n', 'Arabic page is not RTL');
    if (!arBody.includes('فنادق دهب')) issue('medium', 'i18n', 'Arabic title missing');
  } else {
    issue('medium', 'i18n', 'language toggle not found');
  }
  await pageC.screenshot({ path: 'tests/browser-qa/screenshots/hotels/desktop-ar.png' });
  await ctxC.close();

  // ── Desktop header nav link ───────────────────────────────────────────
  console.log('\n━━━ Header nav link (desktop) ━━━');
  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageD = await ctxD.newPage();
  await pageD.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await pageD.waitForTimeout(1500);
  const navLink = pageD.locator('#nav-link-hotels');
  if (await navLink.count()) {
    if (await navLink.isVisible()) {
      await navLink.click();
      await pageD.waitForTimeout(1500);
      console.log(`  → URL: ${pageD.url()}`);
      if (pageD.url().includes('/hotels')) console.log('  ✅ Desktop nav → /hotels');
      else issue('medium', 'nav', `desktop nav went to ${pageD.url()}`);
    } else {
      issue('medium', 'nav', 'desktop #nav-link-hotels hidden at 1440px');
    }
  } else {
    issue('medium', 'nav', 'no #nav-link-hotels in desktop header');
  }
  await ctxD.close();

  // ── Mobile 390 ────────────────────────────────────────────────────────
  console.log('\n━━━ Mobile 390px — list + detail ━━━');
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await setupAuth(ctxM, 'Hotels QA Mobile');
  const pageM = await ctxM.newPage();
  await pageM.goto(`${BASE}/hotels`, { waitUntil: 'networkidle', timeout: 20000 });
  await pageM.waitForTimeout(1500);

  const overflow = await pageM.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    view: window.innerWidth
  }));
  if (overflow.doc > overflow.view + 2) issue('high', 'overflow', `list overflow ${overflow.doc}px > ${overflow.view}px`);
  else console.log(`  ✅ List: no horizontal overflow (${overflow.doc}px)`);

  const dockBtns = await pageM.evaluate(() =>
    Array.from(document.querySelectorAll('nav[aria-label="Mobile Navigation Dock"] button'))
      .map(b => (b.textContent || '').trim()).filter(Boolean));
  console.log(`  Mobile dock buttons: ${dockBtns.join(' | ') || '(none)'}`);
  if (!dockBtns.includes('Hotels')) issue('high', 'nav', 'mobile dock missing Hotels entry');

  await pageM.locator('button:has-text("View stay")').first().click();
  await pageM.waitForTimeout(1500);
  if (!/\/hotels\/[^/]+$/.test(pageM.url())) issue('high', 'detail', `mobile card did not open detail: ${pageM.url()}`);
  const mOverflow = await pageM.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    view: window.innerWidth
  }));
  if (mOverflow.doc > mOverflow.view + 2) issue('high', 'overflow', `detail overflow ${mOverflow.doc}px > ${mOverflow.view}px`);
  else console.log(`  ✅ Detail: no horizontal overflow (${mOverflow.doc}px)`);
  await pageM.screenshot({ path: 'tests/browser-qa/screenshots/hotels/mobile-detail.png' });

  await pageM.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await pageM.waitForTimeout(1500);
  await pageM.locator('nav[aria-label="Mobile Navigation Dock"] button:has-text("Hotels")').first().click();
  await pageM.waitForTimeout(1500);
  console.log(`  Dock Hotels → ${pageM.url()}`);
  if (!pageM.url().includes('/hotels')) issue('medium', 'nav', `mobile dock Hotels went to ${pageM.url()}`);
  await pageM.screenshot({ path: 'tests/browser-qa/screenshots/hotels/mobile-list.png' });
  await ctxM.close();

  // ── Summary ───────────────────────────────────────────────────────────
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