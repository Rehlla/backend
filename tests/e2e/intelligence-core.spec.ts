import { expect, test } from 'playwright/test';
import { signInAsSeed } from './helpers/auth';
import { SEED_EMAILS } from './helpers/config';

/**
 * Dahab Intelligence Core — browser verification.
 *
 * Covers the Definition-of-Done browser matrix for the Core: section loads,
 * orb initializes with a screen-reader state, real backend data answers a
 * question, the floating Core works from another section, Arabic renders,
 * and the layout holds at mobile width.
 *
 * All selectors are locale-agnostic (testids/roles/ids) so the same spec
 * runs in the `en` and `ar` projects.
 */
test.describe('Intelligence Core', () => {
  test('core section loads with orb, command input and attention', async ({ page, context }) => {
    await signInAsSeed(context, SEED_EMAILS.ops);
    await page.goto('/ops-console#core');
    const body = page.locator('body');
    await expect(body).toContainText(/Intelligence Core|نواة الذكاء/, { timeout: 20000 });
    await expect(page.getByTestId('intel-command')).toBeVisible();
    await expect(body).toContainText(/Attention Required|يتطلب الانتباه|All clear|كل شيء واضح/, { timeout: 15000 });
    // The Living-Chart orb renders a real canvas scene on desktop widths
    // (SVG fallback only on small viewports / reduced motion).
    await expect(page.getByTestId('intel-orb').locator('canvas')).toBeVisible({ timeout: 20000 });
  });

  test('asking a question returns real backend data', async ({ page, context }) => {
    await signInAsSeed(context, SEED_EMAILS.ops);
    await page.goto('/ops-console#core');
    await expect(page.getByTestId('intel-command')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('intel-command').fill('Give me the dashboard summary');
    await page.getByTestId('intel-command').press('Enter');
    // Grounded reply naming the deterministic tool output.
    await expect(page.getByRole('log')).toContainText(/bookings|حجوزات/i, { timeout: 20000 });
    await expect(page.getByRole('log')).toContainText('getDashboardSummary', { timeout: 20000 });
  });

  test('floating Core opens from another section', async ({ page, context }) => {
    await signInAsSeed(context, SEED_EMAILS.ops);
    await page.goto('/ops-console#overview');
    const fab = page.getByTestId('intel-fab');
    await expect(fab).toBeVisible({ timeout: 20000 });
    await fab.click();
    const panel = page.getByTestId('intel-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('intel-command-floating')).toBeVisible();
    // Escape closes the dialog and focus returns to the FAB.
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(fab).toBeFocused();
  });

  test('audit trail records a query end to end', async ({ page, context }) => {
    await signInAsSeed(context, SEED_EMAILS.ops);
    await page.goto('/ops-console#core');
    await expect(page.getByTestId('intel-command')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('intel-command').fill('Give me the dashboard summary');
    const [resp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/intelligence-core/query'), { timeout: 30000 }),
      page.getByTestId('intel-command').press('Enter'),
    ]);
    // The query must answer over HTTP 200 — a 429 here once masked a
    // mis-keyed rate limiter that collapsed the whole API into one bucket.
    expect(resp.status()).toBe(200);
    await expect(page.getByRole('log')).toContainText(/bookings|حجوزات/i, { timeout: 20000 });
    await page.getByRole('button', { name: /Show audit trail|عرض سجل التدقيق/ }).click();
    await expect(page.getByRole('list', { name: /Audit trail|سجل التدقيق/ })).toContainText('INTELLIGENCE_CORE_QUERY', { timeout: 15000 });
  });

  test('no horizontal overflow at mobile width', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsSeed(context, SEED_EMAILS.ops);
    await page.goto('/ops-console#core');
    await expect(page.locator('body')).toContainText(/Intelligence Core|نواة الذكاء/, { timeout: 20000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBeFalsy();
  });
});
