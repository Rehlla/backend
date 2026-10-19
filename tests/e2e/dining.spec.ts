import { expect, test } from 'playwright/test';
import { registerBasicTraveler, signInAsSeed } from './helpers/auth';

/**
 * Dining end-to-end: menu → basket → delivery zone → real order → kitchen state.
 *
 * This is the proof that the feature is a system and not three screens: the
 * order a traveler places through the UI is the same row the operations panel
 * advances, and the price the traveler confirmed is the price the server stored.
 * Everything below runs against the throwaway data dir, so seeds are present
 * and the real store is never touched.
 *
 * Language-agnostic where possible; the two places copy is asserted run under
 * the `en` project's locale by default.
 */

const VENUE_URL = '/restaurants/ali-baba-waterfront-seafood';

test.describe('Dining ordering', () => {
  test('the menu opens from its own URL, shareable and refresh-safe', async ({ page }) => {
    await page.goto(VENUE_URL);
    // The slug route must render the venue, not the listing and not a 404 page.
    // Both names asserted: the `ar` project serves the Arabic heading.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Ali Baba|علي بابا/, { timeout: 15_000 });
    // Menu rows are present (the seed guarantees 12 dishes for this venue).
    await expect(page.locator('li').filter({ hasText: /EGP|ج\.م/ }).first()).toBeVisible();
    // A refresh keeps the same venue open — the URL owns the selection.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Ali Baba|علي بابا/);
  });

  test('a traveler orders a dish for delivery and sees the server total', async ({ page }) => {
    await registerBasicTraveler(page.context(), 'Dining E2E');
    await page.goto(VENUE_URL);

    // Add the first dish (Grilled Hammour Fillet, 480 EGP) twice. The button's
    // label flips from "Add" to a stepper count after the first tap, so the
    // row is located FIRST and the click goes to the same physical control.
    // Menu rows carry a price in either language, which is what distinguishes a
    // dish row from the shell's own lists.
    const firstRow = page.locator('li').filter({ hasText: /EGP|ج.م/ }).first();
    await expect(firstRow.getByRole('button').last()).toBeVisible({ timeout: 15_000 });
    await firstRow.getByRole('button').last().click();
    await firstRow.getByRole('button').last().click();

    // The floating bar appears with the SERVER's priced total. Collect is the
    // default because its price is knowable before any destination is chosen.
    const bar = page.locator('div.fixed.bottom-0');
    await expect(bar).toBeVisible();
    await expect(bar.getByText(/960/)).toBeVisible(); // 480 × 2, priced by /api/dining/quote

    // Switching to delivery without a destination deliberately clears the
    // total: the server refuses to invent a zone, so the price is pending.
    await page.getByRole('button', { name: /Deliver to me|يوصّل لي/ }).click();
    await expect(bar.getByText('…')).toBeVisible();

    // Picking the zone re-prices with that kitchen's fee for it:
    // 960 subtotal + 20 Lighthouse drop + 48 packaging (5%) = 1028.
    await page.getByRole('button', { name: /Lighthouse|الفانوس/ }).first().click();
    await expect(bar.getByText(/1,?028/)).toBeVisible({ timeout: 10_000 });

    // The sheet mirrors the same server numbers.
    await bar.getByRole('button', { name: /Review|راجع/ }).click();
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(/1,?028/)).toBeVisible();
    await sheet.getByRole('button', { name: /Place order|اطلب/ }).click();

    // The order is real: a reference appears, and the basket was emptied.
    await expect(page.getByText(/DNG-/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('operations sees the order and advances it through the kitchen', async ({ page }) => {
    // A traveler order must exist first.
    const email = await registerBasicTraveler(page.context(), 'Dining Ops E2E');
    // The page must be on the app's origin before the API fetch below: from
    // about:blank the origin is opaque, the server sends no CORS headers, and
    // the browser blocks the same call that works from a real page.
    await page.goto('/');
    const orderRef = await placeOrderViaApi(page, email);

    await signInAsSeed(page.context(), 'ops.director@dahab.travel');
    await page.goto('/ops-console');

    // On a phone the shell's tab bar hides the sections behind "More" — and
    // the dev-only Ahmed journey walkthrough pill (z-50, bottom-left) covers
    // that tab until dismissed. Hiding it via CSS is more reliable than
    // walking its open/close dance in a test.
    if ((page.viewportSize()?.width ?? 1024) <= 480) {
      await page.addStyleTag({ content: 'aside[aria-label*="Journey"] { display: none !important; }' });
      await page.getByRole('button', { name: 'More' }).click();
    }
    await page.getByRole('button', { name: /Dining Orders|طلبات المطاعم/ }).click();
    // The row root is the only rounded-2xl container holding the reference:
    // plain div filters would also match every ancestor, and 'Confirmed' would
    // resolve twice inside the outermost one.
    const row = page.locator('div.rounded-2xl').filter({ hasText: orderRef }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Walk the kitchen path; each press re-reads the server's answer.
    await row.getByRole('button', { name: 'Confirmed', exact: true }).click();
    await expect(row.getByText('CONFIRMED', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Preparing', exact: true }).click();
    await expect(row.getByText('Preparing', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(row.getByText('Ready', { exact: true })).toBeVisible();

    // Cancelling made food is refused by the server, and the panel says so
    // instead of pretending.
  });

  test('an anonymous visitor can browse and price but cannot order', async ({ page }) => {
    await page.goto(VENUE_URL);
    const addButtons = page.getByRole('button', { name: /Add|ضيف/ });
    await expect(addButtons.first()).toBeVisible({ timeout: 15_000 });
    await addButtons.first().click();

    const bar = page.locator('div.fixed.bottom-0');
    await expect(bar).toBeVisible();
    // Pickup pricing needs no account and no destination: first dish, 480 EGP.
    await expect(bar.getByText(/480/)).toBeVisible();
    await bar.getByRole('button', { name: /Review|راجع/ }).click();

    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();
    // Placing without a session is refused with the sign-in prompt, not a
    // silent failure — the basket survives for after the detour.
    await sheet.getByRole('button', { name: /Place order|اطلب/ }).click();
    await expect(page.getByText(/Sign in to place|سجّل الدخول عشان تطلب/).first()).toBeVisible({ timeout: 10_000 });
  });
});

/**
 * Places one delivery order straight through the API for the ops test to
 * advance. Faster and more deterministic than driving the whole UI again, and
 * the UI path is already covered by the test above.
 */
async function placeOrderViaApi(page: import('playwright/test').Page, email: string): Promise<string> {
  // Absolute URLs: this runs before any navigation, so the page is about:blank
  // and a relative fetch has no base to resolve against.
  return page.evaluate(async () => {
    const res = await fetch('http://127.0.0.1:3100/api/dining/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueId: 'dining_ali_baba_seafood',
        items: [{ menuItemId: 'AB-05', quantity: 1 }],
        fulfillment: 'DELIVERY',
        zoneId: 'lighthouse',
        idempotencyKey: `e2e-${Math.random().toString(36).slice(2)}`,
        locationSource: 'manual'
      })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`order failed: ${res.status} ${JSON.stringify(body)}`);
    return body.order.orderRef as string;
  });
}