import { expect, test } from 'playwright/test';

/**
 * Homepage smoke + overflow sweep. Language-agnostic: both the `en` and `ar`
 * projects run this file, so assertions never depend on a single language.
 */
test.describe('Home', () => {
  test('desktop renders hero, journey entry and footer without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#cinematic-hero-cockpit')).toBeVisible();
    const heroH1 = page.locator('#cinematic-hero-cockpit h1').first();
    await expect(heroH1).toBeVisible();
    expect((await heroH1.textContent())?.trim().length ?? 0).toBeGreaterThan(0);

    await expect(page.locator('#how-do-you-want-to-experience-dahab')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }));
    expect(overflow.doc, `horizontal overflow ${overflow.doc}px > ${overflow.view}px`).toBeLessThanOrEqual(overflow.view + 2);
  });

  test('mobile 390 renders without overflow and the journey pathway is present', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('#pathway-build-myself')).toBeVisible();
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }));
    expect(overflow.doc, `horizontal overflow ${overflow.doc}px > ${overflow.view}px`).toBeLessThanOrEqual(overflow.view + 2);
  });
});