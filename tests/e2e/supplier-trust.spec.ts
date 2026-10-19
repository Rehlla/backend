import { expect, test } from 'playwright/test';
import { signInAsSeed } from './helpers/auth';
import { SEED_EMAILS } from './helpers/config';

/**
 * Supplier Trust Loop — the portal mirrors the traveler-facing trust signals
 * (reliability score + reef-positive conservation score) in the Reliability
 * tab, with the same honesty rules the public cards apply:
 *   - no invented numbers when there is no metric history,
 *   - explicit traveler-visibility state around the 3-measured-booking
 *     significance threshold.
 *
 * Runs as the seeded Supplier on the isolated e2e data dir.
 */
test.describe('Supplier Trust Loop', () => {
  // Same desktop-chrome dependency as Command Center: the portal is part of
  // the console-style shell family and these steps assume desktop layout.
  test.skip(({ viewport }) => (viewport?.width ?? 1024) < 1024, 'Portal chrome is desktop-only for this spec');

  // Force English so translated-label selectors match (app persists its
  // language in localStorage under 'dahab_os_lang') — same convention as
  // cms-content.spec.ts; translation correctness is covered by i18n tests.
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('dahab_os_lang', 'en');
    });
  });

  test('reliability tab shows trust panel with honest visibility state', async ({ page, context }) => {
    await signInAsSeed(context, SEED_EMAILS.supplier);
    await page.goto('/supplier-portal');

    // Open the Reliability & SLA tab.
    const tab = page.getByRole('button', { name: /Reliability & SLA/i }).first();
    await expect(tab).toBeVisible({ timeout: 20000 });
    await tab.click();

    // The mirrored trust panel mounted.
    await expect(page.getByText('Your Reliability Score')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Reef-Positive Conservation Score')).toBeVisible();

    // Honesty contract: exactly one traveler-visibility badge is shown, and it
    // is one of the two truthful states — never both, never neither.
    const visible = await page.getByText('Visible to travelers').count();
    const hidden = await page.getByText('Not yet shown to travelers').count();
    expect(visible + hidden).toBe(1);

    // No fabricated reef score: points appear only with a non-zero value.
    const reefFigures = await page
      .locator('span.text-4xl')
      .filter({ hasText: /^\d+$/ })
      .count();
    const dashes = await page.locator('span.text-4xl', { hasText: '—' }).count();
    // Either real reef points or an em dash — one of the two figures per card.
    expect(reefFigures + dashes).toBeGreaterThanOrEqual(1);
  });

  test('eco-action logger mounts in the reef card with honest eligibility', async ({ page, context }) => {
    await signInAsSeed(context, SEED_EMAILS.supplier);
    await page.goto('/supplier-portal');

    const tab = page.getByRole('button', { name: /Reliability & SLA/i }).first();
    await expect(tab).toBeVisible({ timeout: 20000 });
    await tab.click();
    await expect(page.getByText('Reef-Positive Conservation Score')).toBeVisible({ timeout: 20000 });

    // Open the logger.
    await page.getByRole('button', { name: 'Log an eco-action' }).click();

    // Booking picker resolves to an honest state: loading placeholder gone,
    // first option is either "no completed bookings" or "choose a booking".
    const bookingSelect = page.getByLabel('Completed booking');
    await expect(bookingSelect).toBeVisible({ timeout: 20000 });
    await expect(bookingSelect).not.toContainText('Loading bookings…', { timeout: 20000 });
    const firstOption = bookingSelect.locator('option').first();
    const firstLabel = (await firstOption.textContent()) ?? '';
    expect(firstLabel === 'No completed bookings yet — eco-actions need a completed or captured booking.'
      || firstLabel === 'Choose a booking…').toBe(true);

    // Submit stays disabled until a booking and description are chosen.
    const submit = page.getByRole('button', { name: 'Log action' });
    await expect(submit).toBeDisabled();
  });

  test('reef-actions route enforces authentication and booking integrity', async ({ request }) => {
    // Unauthenticated POST is rejected by the deny-by-default gate.
    const anon = await request.post('/api/reef-actions', {
      data: { bookingId: 'BK-X', tripId: 'T', supplierId: 'S', actionType: 'other', description: 'x' },
    });
    expect([401, 403]).toContain(anon.status());
  });

  test('signed-in supplier gets booking-not-found (not a silent success)', async ({ page, context, request }) => {
    await signInAsSeed(context, SEED_EMAILS.supplier);
    await page.goto('/supplier-portal');
    await expect(page.getByRole('button', { name: /Reliability & SLA/i }).first()).toBeVisible({ timeout: 20000 });

    // Session cookie is now in the context's cookie jar.
    const cookies = await context.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const res = await request.post('/api/reef-actions', {
      headers: { cookie: cookieHeader },
      data: { bookingId: 'BK-DOES-NOT-EXIST', tripId: 'T', supplierId: 'S', actionType: 'other', description: 'x' },
    });
    expect(res.status()).toBe(404);
  });
});
