import { expect, test } from 'playwright/test';
import { signInAsSeed } from './helpers/auth';
import { SEED_EMAILS } from './helpers/config';
import { captureSnapshot } from './helpers/renderSnapshot';

/**
 * MyTrip render baseline (§3 of the fix plan).
 *
 * Renders /my-trip as the seeded Ahmed traveler, both English and Arabic (the
 * `ar` project), and for each of the three dashboard tabs captures a normalised
 * outerHTML file and a full-page PNG into tests/e2e/snapshots/mytrip/.
 *
 * §3 refactors MyTripView into sections; the contract is that these baseline
 * files stay byte-identical except for the intentional budget-number change.
 * The captured files are compared with git, not asserted at test time.
 */
const TABS = ['timeline', 'bookings', 'tools'] as const;

test('captures the MyTrip render baseline per tab and language', async ({ page, context }) => {
  await signInAsSeed(context, SEED_EMAILS.traveler);
  await page.goto('/my-trip');

  await expect(page.locator('#dashboard-tab-timeline')).toBeVisible({ timeout: 20000 });

  // Each tab is its own snapshot folder (tests/e2e/snapshots/mytrip/<tab>/) with
  // one `en.html`/`ar.html` + `.png` pair per language project.
  for (const tab of TABS) {
    await page.locator(`#dashboard-tab-${tab}`).click();
    await page.waitForTimeout(350);
    await captureSnapshot(page, `mytrip/${tab}`);
  }
});