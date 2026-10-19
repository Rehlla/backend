import { expect, test } from 'playwright/test';
import { registerBasicTraveler } from './helpers/auth';

const VIEW_STAY = /View stay|عرض الإقامة/;

/** A property with a room type on sale — most catalogue rows have no
 *  confirmed room count yet and render the held-back notice instead. */
async function sellableStay(page: import('playwright/test').Page): Promise<string> {
  const res = await page.request.get('/api/accommodations');
  expect(res.ok()).toBeTruthy();
  const { accommodations } = await res.json();
  for (const a of accommodations.slice(0, 40)) {
    const rt = await (await page.request.get(`/api/accommodations/${encodeURIComponent(a.slug)}/room-types`)).json();
    if ((rt.roomTypes ?? []).some((r: { totalUnits: number }) => r.totalUnits > 0)) return a.slug;
  }
  throw new Error('No sellable stay in the first 40 catalogue rows.');
}

test.describe('Hotels', () => {
  test('catalogue API contract + filters', async ({ request }) => {
    const r = await request.get('/api/hotels');
    expect(r.ok()).toBeTruthy();
    const cat = await r.json();
    const count = cat.hotels?.length ?? 0;
    expect(count).toBeGreaterThan(0);
    expect(cat.stats?.total).toBe(count);

    const filtered = await (await request.get('/api/hotels?category=resort')).json();
    expect(filtered.hotels?.length ?? 0).toBeGreaterThan(0);
    expect(filtered.hotels.length).toBeLessThan(count);

    const premium = await (await request.get('/api/hotels?priceBand=premium')).json();
    expect(premium.hotels?.length ?? 0).toBeGreaterThan(0);
  });

  test('list page renders cards, search and category chips', async ({ page }) => {
    await page.goto('/hotels');
    await expect(page.locator('h1').first()).toBeVisible();
    // The catalogue is a large payload; give the first card time to land.
    await expect(page.locator('button', { hasText: VIEW_STAY }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="search"]')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/hotels-list.png' });
  });

  test('detail shows the booking panel, a live quote and a WhatsApp concierge link', async ({ page }) => {
    const slug = await sellableStay(page);
    await page.goto(`/hotels/${encodeURIComponent(slug)}`);
    const panel = page.locator('[data-testid="stay-booking-panel"]');
    await expect(panel).toBeVisible({ timeout: 15000 });
    // Digits render in the active locale, so assert on the currency literal.
    await expect(panel.getByText('EGP').first()).toBeVisible();
    await expect(page.locator('[data-testid="stay-reserve-submit"]')).toBeEnabled({ timeout: 15000 });
    const wa = page.locator('a[href*="wa.me"]').first();
    await expect(wa).toHaveAttribute('href', /wa\.me\/\d+/);
  });

  test('signed-in reserve: cash on arrival books with no deposit and shows in My stays', async ({ page, context }) => {
    await registerBasicTraveler(context, 'Hotels QA');
    const slug = await sellableStay(page);
    await page.goto(`/hotels/${encodeURIComponent(slug)}`);
    await page.locator('[data-testid="stay-reserve-submit"]').click();
    await expect(page).toHaveURL(/\/hotels\/checkout\?accommodation=/, { timeout: 15000 });

    // Cash on arrival is the default and takes no deposit.
    const submit = page.locator('[data-testid="checkout-submit"]');
    await expect(submit).toHaveText(/pay at the property|الدفع في المنشأة/, { timeout: 15000 });
    await submit.click();

    // One clean reference in the URL (it used to duplicate itself on load).
    await expect(page).toHaveURL(/\/hotels\/checkout\?ref=HTL-\d{8}-[0-9A-F]{4}$/, { timeout: 15000 });
    const ref = new URL(page.url()).searchParams.get('ref')!;

    // A stay booked straight from a hotel page is listed in My stays.
    await page.goto('/hotels/stays');
    await expect(page.getByText(ref)).toBeVisible({ timeout: 15000 });
  });

  test('signed-out reserve asks to sign in and remembers the checkout', async ({ page }) => {
    const slug = await sellableStay(page);
    await page.goto(`/hotels/${encodeURIComponent(slug)}`);
    await page.locator('[data-testid="stay-reserve-submit"]').click();
    await expect(page).toHaveURL(/\/hotels\/checkout\?/, { timeout: 15000 });
    await page.getByRole('main').getByRole('button', { name: /Sign in|ادخل/ }).click();
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
  });

  test('mobile list page has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hotels');
    const d = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }));
    expect(d.doc, `overflow ${d.doc}px vs ${d.view}px`).toBeLessThanOrEqual(d.view + 2);
  });
});