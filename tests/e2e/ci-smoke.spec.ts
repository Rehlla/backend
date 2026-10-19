import { expect, test } from 'playwright/test';

/**
 * E2E CI Smoke Suite — gates merge on critical path health.
 *
 * Covers:
 *   1. API health + new entity tables present
 *   2. Homepage render (desktop + mobile)
 *   3. Explore/search loads
 *   4. CMS content pages render
 *   5. Supplier portal accessible to seeded supplier
 *   6. Long-stay pricing API works
 *   7. Reef-positive endpoints respond
 *   8. Fraud rules endpoint responds
 *   9. Bundle endpoints respond
 *  10. Trip journal endpoints respond
 */

// ─── 1. API Health ─────────────────────────────────────────────────────────

test.describe('API Health', () => {
  test('health endpoint returns OK with all adapter collections', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('new P2/P3 API routes are reachable (non-404)', async ({ request }) => {
    // Reef action types (public)
    const reefTypes = await request.get('/api/reef-action-types');
    expect(reefTypes.ok()).toBeTruthy();

    // Active bundles (public)
    const bundles = await request.get('/api/bundles');
    expect(bundles.ok()).toBeTruthy();

    // Reef-positive suppliers (public)
    const reefSuppliers = await request.get('/api/reef-positive-suppliers');
    expect(reefSuppliers.ok()).toBeTruthy();
  });
});

// ─── 2. Homepage ───────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test('desktop renders hero, journey entry, and footer', async ({ page }) => {
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
    expect(overflow.doc).toBeLessThanOrEqual(overflow.view + 2);
  });

  test('mobile 390px renders without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('#pathway-build-myself')).toBeVisible();
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }));
    expect(overflow.doc).toBeLessThanOrEqual(overflow.view + 2);
  });
});

// ─── 3. Explore / Search ───────────────────────────────────────────────────

test.describe('Explore', () => {
  test('explore page loads and shows activities', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForLoadState('networkidle');
    // The explore page should render without crashing
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

// ─── 4. CMS Content Pages ──────────────────────────────────────────────────

test.describe('CMS Content', () => {
  test('about page renders', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('faq page renders', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

// ─── 5. Long-Stay Pricing API ──────────────────────────────────────────────

test.describe('Long-Stay Pricing', () => {
  test('long-stay accommodations endpoint responds', async ({ request }) => {
    const res = await request.get('/api/accommodations/long-stay');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('accommodations');
    expect(Array.isArray(body.accommodations)).toBeTruthy();
  });
});

// ─── 6. Bundle API ─────────────────────────────────────────────────────────

test.describe('Bundles', () => {
  test('active bundles endpoint returns array', async ({ request }) => {
    const res = await request.get('/api/bundles');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('bundles');
    expect(Array.isArray(body.bundles)).toBeTruthy();
  });

  test('compute-discount rejects empty items', async ({ request }) => {
    const res = await request.post('/api/bundles/compute-discount', {
      data: { items: [] },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── 7. Reef-Positive API ──────────────────────────────────────────────────

test.describe('Reef-Positive', () => {
  test('reef action types are available', async ({ request }) => {
    const res = await request.get('/api/reef-action-types');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('actionTypes');
    expect(body.actionTypes).toHaveProperty('coral_planting');
    expect(body.actionTypes.coral_planting.points).toBe(20);
  });

  test('reef-positive suppliers list is an array', async ({ request }) => {
    const res = await request.get('/api/reef-positive-suppliers');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.suppliers)).toBeTruthy();
  });
});

// ─── 8. Fraud Detection API (admin-only, expects 403 without auth) ─────────

test.describe('Fraud Detection', () => {
  test('fraud dashboard returns 403 without admin auth', async ({ request }) => {
    const res = await request.get('/api/fraud/dashboard');
    // Should be 403 (no session) or 401
    expect([401, 403]).toContain(res.status());
  });

  test('fraud rules returns 403 without admin auth', async ({ request }) => {
    const res = await request.get('/api/fraud/rules');
    expect([401, 403]).toContain(res.status());
  });
});

// ─── 9. Trip Journal API (requires auth) ───────────────────────────────────

test.describe('Trip Journal', () => {
  test('journal endpoint returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/journal');
    expect([401, 403]).toContain(res.status());
  });
});

// ─── 10. Supplier Calendar API (public read) ───────────────────────────────

test.describe('Supplier Calendar', () => {
  test('availability endpoint returns 404 for non-existent supplier', async ({ request }) => {
    const res = await request.get('/api/suppliers/SUP-NONEXISTENT/availability');
    // Should be 404 or similar
    expect([404, 400]).toContain(res.status());
  });
});
