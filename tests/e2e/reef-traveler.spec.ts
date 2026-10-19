import { expect, test } from 'playwright/test';
import { signInAsSeed } from './helpers/auth';
import { SEED_EMAILS } from './helpers/config';

/**
 * Traveler reef loop — the my-trip bookings tab carries the traveler's
 * conservation record ("Your Reef Impact") and the shared eco-action logger.
 *
 * Honesty contract verified here:
 *  - the points figure is either the server's real number or an em dash —
 *    never an invented zero,
 *  - the logger's booking picker resolves to one of the two truthful states
 *    (loading → "choose a booking" / "no completed bookings"),
 *  - submit stays disabled until a booking and description are chosen.
 *
 * Runs as the seeded traveler (Ahmed) on the isolated e2e data dir. English is
 * forced so label selectors match; translation coverage lives in i18n tests.
 */
test.describe('Traveler Reef Impact', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('dahab_os_lang', 'en');
    });
  });

  test('conservation card and logger mount truthfully in the bookings tab', async ({ page, context }) => {
    await signInAsSeed(context, SEED_EMAILS.traveler);
    await page.goto('/my-trip');

    await expect(page.locator('#dashboard-tab-bookings')).toBeVisible({ timeout: 20000 });
    await page.locator('#dashboard-tab-bookings').click();

    // The conservation card mounted.
    await expect(page.getByText('Your Reef Impact')).toBeVisible({ timeout: 20000 });

    // Points figure is honest: real number or em dash, never an invented 0.
    const card = page.locator('div.rounded-3xl').filter({
      has: page.getByRole('heading', { name: 'Your Reef Impact' }),
    }).first();
    const figure = card.locator('span.text-2xl').first();
    const text = (await figure.textContent()) ?? '';
    expect(text === '—' || /^\d+$/.test(text.trim())).toBe(true);

    // Open the logger and let the booking picker resolve.
    await page.getByRole('button', { name: 'Log an eco-action' }).click();
    const bookingSelect = page.getByLabel('Completed booking');
    await expect(bookingSelect).toBeVisible();
    await expect(bookingSelect).not.toContainText('Loading bookings…', { timeout: 20000 });

    const firstOption = bookingSelect.locator('option').first();
    const firstLabel = (await firstOption.textContent()) ?? '';
    expect(
      firstLabel === 'No completed bookings yet — eco-actions need a completed or captured booking.'
      || firstLabel === 'Choose a booking…'
    ).toBe(true);

    // Submit stays disabled until a booking and description are chosen.
    await expect(page.getByRole('button', { name: 'Log action' })).toBeDisabled();
  });
});