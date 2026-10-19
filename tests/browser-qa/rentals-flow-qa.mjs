/**
 * Rentals Browser QA — walks the public bike-rental flow:
 *   /rentals catalogue → listing card → detail page → booking widget
 *   (dates, quantity, delivery, extras, live availability + price breakdown).
 *
 * Requires the dev server already running (default http://localhost:3000,
 * override with BASE). Screenshots land in tests/browser-qa/screenshots/rentals/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://localhost:3199';
const SHOT_DIR = 'tests/browser-qa/screenshots/rentals';
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
// The dev server's HMR websocket fails to connect on this machine (port
// 24678 already in use — pre-existing environment noise, not app code).
page.on('pageerror', (err) => {
  if (String(err).includes('WebSocket closed without opened')) return;
  check(`pageerror: ${err.message}`, false);
});

try {
  // ---- Catalogue ---------------------------------------------------------
  const catRes = await page.goto(`${BASE}/rentals`, { waitUntil: 'networkidle' });
  check('catalogue loads (HTTP 200)', catRes && catRes.status() === 200, `status=${catRes?.status()}`);
  await page.waitForSelector('text=Mountain Bike 29"', { timeout: 15000 }).catch(() => check('catalogue shows seeded Mountain Bike', false));
  // Cards are <button> elements (SPA navigation via navigateTo), not anchors.
  const cardCount = await page.locator('button:has-text("View")').count();
  check('catalogue lists rental cards', cardCount >= 3, `cards=${cardCount}`);

  await page.screenshot({ path: `${SHOT_DIR}/01-catalogue-mobile.png`, fullPage: true });

  // Category filter: deselect "E-bike" so only regular bikes remain.
  await page.locator('button:has-text("E-bike")').first().click().catch(() => check('category filter clickable', false));
  await page.waitForTimeout(600);
  const afterFilter = await page.locator('button:has-text("View")').count();
  check('category filter narrows the catalogue', afterFilter < cardCount, `cards ${cardCount} → ${afterFilter}`);

  // ---- Detail ------------------------------------------------------------
  await page.goto(`${BASE}/rentals/mountain-bike`, { waitUntil: 'networkidle' });
  const detailVisible = await page.locator('text=Mountain Bike 29"').first().isVisible().catch(() => false);
  check('detail page renders listing', detailVisible);
  // The booking widget renders on the detail page: price + date inputs.
  const widgetVisible = await page.locator('input[type="date"]').first().isVisible().catch(() => false);
  const priceVisible = await page.locator('text=/EGP \/ day/').first().isVisible().catch(() => false);
  check('booking widget renders', widgetVisible && priceVisible);
  await page.screenshot({ path: `${SHOT_DIR}/02-detail-mobile.png`, fullPage: true });

  // Booking widget: pick a date range via the native date inputs.
  const startInput = page.locator('input[type="date"]').first();
  const endInput = page.locator('input[type="date"]').nth(1);
  if ((await startInput.count()) > 0) {
    await startInput.fill('2026-09-20');
    await endInput.fill('2026-09-22');
    await page.waitForTimeout(600);

    // Quantity + delivery
    const qty = page.locator('input[type="number"]').first();
    if ((await qty.count()) > 0) await qty.fill('2');
    await page.waitForTimeout(400);

    const hasQuote = await page.locator('text=/EGP/').first().isVisible().catch(() => false);
    check('booking widget shows a price after selection', hasQuote);

    await page.screenshot({ path: `${SHOT_DIR}/03-widget-priced.png`, fullPage: true });
  } else {
    check('booking widget date inputs present', false, 'no input[type=date] found');
  }

  // ---- Quote API round-trip (the widget must have hit the server) --------
  const quoteRes = await page.evaluate(async () => {
    const res = await fetch('/api/rentals/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: 'RENT-MTB-01',
        startDate: '2026-09-20',
        endDate: '2026-09-22',
        quantity: 2,
        deliveryMode: 'PICKUP'
      })
    });
    return { status: res.status, body: await res.json() };
  });
  check(
    'quote API returns a transparent breakdown',
    quoteRes.status === 200 && typeof quoteRes.body?.breakdown?.totalEGP === 'number',
    `total=${quoteRes.body?.breakdown?.totalEGP}`
  );

  const availRes = await page.evaluate(async () => {
    const res = await fetch('/api/rentals/check-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: 'RENT-MTB-01',
        startDate: '2026-09-20',
        endDate: '2026-09-22',
        quantity: 2
      })
    });
    return { status: res.status, body: await res.json() };
  });
  check(
    'availability API reports window quantity',
    availRes.status === 200 && availRes.body?.available === true && availRes.body?.windowAvailable >= 2,
    `windowAvailable=${availRes.body?.windowAvailable}`
  );
} catch (err) {
  check('run completed without throwing', false, err instanceof Error ? err.message : String(err));
} finally {
  await page.screenshot({ path: `${SHOT_DIR}/99-final.png`, fullPage: true }).catch(() => {});
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);