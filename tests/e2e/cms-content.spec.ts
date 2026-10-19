import { expect, test, type Page } from 'playwright/test';
import { signInAsSeed } from './helpers/auth';
import { SEED_EMAILS } from './helpers/config';

/**
 * Admin CMS content CRUD e2e — pages, metadata auto-save, and navigation.
 *
 * Runs against the isolated throwaway data dir from playwright.config.ts
 * (never the real data/ store), signed in as the seeded Admin. The CMS
 * dashboard lives at /ops-console under the "CMS Content" section; the
 * console shell deep-links via the URL hash (#cms).
 *
 * Note: the console supports both English and Arabic (a language toggle in
 * the header defaults per browser locale). Tests assert against
 * language-neutral DOM facts (buttons exist, dialogs behave) rather than
 * translated strings where possible.
 */

test.describe('CMS Content (Admin)', () => {
  // Same desktop-chrome dependency as Command Center: the console sidebar is
  // `hidden lg:flex`; mobile uses a bottom nav instead. Skip below lg per the
  // mobile-375 project convention in playwright.config.ts.
  test.skip(({ viewport }) => (viewport?.width ?? 1024) < 1024, 'Console sidebar chrome is desktop-only (lg breakpoint)');

  const openCms = async (page: Page, subTab = '') => {
    await page.goto(`/ops-console#cms${subTab ? `/${subTab}` : ''}`);
    // Wait until the console shell has mounted
    const sidebar = page.getByRole('main', { name: 'Dahab Sinai Travel Platform' }).getByRole('complementary');
    await expect(sidebar.locator('nav button').first()).toBeVisible({ timeout: 20000 });
  };

  test.beforeEach(async ({ context }) => {
    // Force English so translated-label selectors match (app persists its
    // language in localStorage under 'dahab_os_lang')
    await context.addInitScript(() => {
      window.localStorage.setItem('dahab_os_lang', 'en');
    });
    await signInAsSeed(context, SEED_EMAILS.admin);
  });

  test('dashboard loads with the CMS section active', async ({ page }) => {
    await openCms(page, 'pages');
    // The Pages sub-tab's own chrome (New Page button) proves the section mounted
    await expect(page.locator('button', { hasText: /^New Page$/i })).toBeVisible({ timeout: 20000 });
  });

  test('create page from template and metadata auto-saves (debounced)', async ({ page }) => {
    await openCms(page, 'pages');
    const newPageBtn = page.locator('button', { hasText: /^New Page$/i }).first();
    await expect(newPageBtn).toBeVisible({ timeout: 20000 });
    await newPageBtn.click();

    // Pick the first available template
    const templateBtn = page.locator('button').filter({ hasText: /blank|template|standard|basic/i }).first();
    await expect(templateBtn).toBeVisible({ timeout: 10000 });
    await templateBtn.click();

    // The dashboard creates the page with slug new-page-<Date.now()>. Find the
    // newest such page via the API (page.request shares the browser session's
    // auth cookies) and use it as proof the create path persisted server-side.
    const res = await page.request.get('/api/admin/content/pages');
    const list = await res.json().catch(() => null);
    const pages = Array.isArray(list?.pages) ? list.pages : [];
    const qaPage = pages
      .filter((p: any) => String(p.slug || '').startsWith('new-page-'))
      .sort((a: any, b: any) => Number(String(b.slug).slice('new-page-'.length)) - Number(String(a.slug).slice('new-page-'.length)))[0];
    expect(qaPage).toBeTruthy();

    // Grab the page via the API (detail route is keyed by id) to confirm it
    // exists server-side
    const check = await page.request.get(`/api/admin/content/pages/${qaPage.id}`);
    expect(check.ok()).toBeTruthy();

    // The editor is open after template creation. Bilingual fields start
    // collapsed — expand the Title field, fill the EN input, wait out the
    // 1.5s debounce, then confirm the PATCH persisted server-side.
    await page.getByRole('button', { name: /Title/i }).first().click();
    const enTitle = page.locator('span', { hasText: /^EN$/i }).first().locator('xpath=following-sibling::input');
    await enTitle.fill('E2E QA Renamed', { timeout: 10000 });
    await page.waitForTimeout(2500);
    const after = await (await page.request.get(`/api/admin/content/pages/${qaPage.id}`)).json();
    expect(after?.page?.title_en ?? after?.title_en ?? '').toContain('E2E QA Renamed');

    // Clean up: delete the QA page via the API (Admin session is shared)
    const del = await page.request.delete(`/api/admin/content/pages/${qaPage.id}`);
    expect([200, 204, 404]).toContain(del.status());
  });

  test('navigation item add and delete', async ({ page }) => {
    await openCms(page, 'navigation');
    const body = page.locator('body');

    // Navigation sub-tab is deep-linked; wait for its chrome
    const addBtn = page.locator('button').filter({ hasText: /add item|add navigation|add/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    const inputs = page.locator('input:visible');
    await inputs.nth(0).fill('E2E QA Item');
    await inputs.nth(1).fill('عنصر الاختبار');
    await inputs.nth(2).fill('/e2e-qa-route');
    await page.locator('button').filter({ hasText: /^(Save|Add|Create)/i }).last().click();
    await expect(body).toContainText('E2E QA Item', { timeout: 10000 });

    // Delete it (accept the native confirm dialog). The item's row is the
    // outermost div containing the label — target via text then climb to the
    // row container that holds the action buttons.
    page.once('dialog', d => d.accept());
    const row = page.locator('div').filter({ has: page.getByText('E2E QA Item', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Delete item' }) }).last();
    await row.getByRole('button', { name: 'Delete item' }).click();
    await expect(body).not.toContainText('E2E QA Item', { timeout: 10000 });
  });
});
