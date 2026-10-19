/**
 * FULL SITE TOUR — read-only browser QA.
 *
 * Walks every public route of the Dahab platform in a VISIBLE Chrome window,
 * checks each view actually renders (no error boundary, meaningful content),
 * exercises key interactions (navbar, search drawer, quick book, language
 * switch, theme selector), and screenshots everything.
 *
 * Read-only by design: no registrations, no bookings, no writes to the store.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

const BASE_URL = process.env.TARGET_URL || 'http://localhost:3000';
const SHOT_DIR = path.join(import.meta.dirname, 'screenshots', 'full-site-tour');
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
let total = 0;
let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  total++;
  if (ok) passed++; else failed++;
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function visit(page, route, name, opts = {}) {
  const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9-]/gi, '_');
  const consoleErrors = [];
  const onPageError = (e) => consoleErrors.push(String(e));
  page.on('pageerror', onPageError);
  try {
    await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(opts.settle || 4500);
    // Detect error boundaries / fatal fallbacks
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || '');
    const hasErrorBoundary = /something went wrong|view crashed|failed to render|an error occurred/i.test(bodyText);

    let contentOk = true;
    let contentHint = '';
    if (opts.expect) {
      contentOk = opts.expect.some((re) => re.test(bodyText));
      contentHint = opts.expect.map((re) => re.source).join(' | ');
    } else if (opts.expectAny) {
      contentOk = opts.expectAny.test(bodyText);
      contentHint = opts.expectAny.source;
    } else if (opts.expectMinChars) {
      contentOk = bodyText.trim().length >= opts.expectMinChars;
      contentHint = `>= ${opts.expectMinChars} chars of text`;
    }

    const screenshot = path.join(SHOT_DIR, `${slug}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });

    const ok = !hasErrorBoundary && contentOk && consoleErrors.length === 0;
    record(name, ok, hasErrorBoundary ? 'error boundary shown' : (consoleErrors.length ? `pageerror: ${consoleErrors[0].slice(0, 120)}` : (contentOk ? `ok (${bodyText.trim().length} chars)` : `missing content, expected: ${contentHint}`)));
  } catch (e) {
    record(name, false, String(e).slice(0, 160));
    try {
      await page.screenshot({ path: path.join(SHOT_DIR, `${slug}-ERROR.png`) });
    } catch {}
  } finally {
    page.off('pageerror', onPageError);
  }
}

async function main() {
  console.log(`\n🚀 DAHAB FULL SITE TOUR — read-only browser QA`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Screenshots: ${SHOT_DIR}\n`);

  // Visible Chrome so the user can watch.
  const browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 40 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ─── HOME ────────────────────────────────────────────────────────────────
  await visit(page, '/', 'Home cockpit renders', { expectAny: /discover|dahab|explore|plan/i, settle: 6000 });

  // Navbar present?
  const navOk = await page.locator('header, nav').first().isVisible().catch(() => false);
  record('Floating navbar visible', navOk);

  // ─── NAVBAR LINKS — follow every primary link ───────────────────────────
  const linkTargets = [
    ['/hotels', 'Hotels page'],
    ['/attractions', 'Things to Do page'],
    ['/explore', 'Explore page'],
    ['/transfers', 'Transfers hub'],
    ['/rentals', 'Bike rentals'],
    ['/food', 'Food & dining'],
    ['/restaurants', 'Restaurants'],
    ['/experiences', 'Experiences'],
    ['/bookings', 'Bookings (gate check)'],
    ['/my-trip', 'My Trip (gate check)'],
    ['/live', 'Dahab Live'],
  ];
  for (const [route, name] of linkTargets) {
    await visit(page, route, name, { expectMinChars: 120, settle: 4000 });
  }

  // ─── EXPLORE DETAIL LANDING PAGES ───────────────────────────────────────
  await visit(page, '/programs', 'Programs detail', { expectMinChars: 100, settle: 4000 });
  await visit(page, '/listings', 'Listings view', { expectMinChars: 100, settle: 4000 });

  // ─── AI / PLANNER SURFACES ──────────────────────────────────────────────
  await visit(page, '/daygi', 'DayGi AI concierge', { expectMinChars: 100, settle: 5000 });
  await visit(page, '/plan-for-me', 'Plan-for-me planner', { expectMinChars: 100, settle: 4000 });
  await visit(page, '/trip-builder', 'Trip builder', { expectMinChars: 100, settle: 4000 });

  // ─── TRIP STAGES ────────────────────────────────────────────────────────
  await visit(page, '/trip-preview', 'Trip preview', { expectMinChars: 100, settle: 4000 });
  await visit(page, '/arrive', 'Early arrival', { expectMinChars: 100, settle: 4000 });
  await visit(page, '/first-two-hours', 'First two hours', { expectMinChars: 100, settle: 4000 });
  await visit(page, '/change-recovery', 'Change & recovery', { expectMinChars: 100, settle: 4000 });
  await visit(page, '/help', 'Help me now', { expectMinChars: 100, settle: 4000 });

  // ─── COMMERCE ───────────────────────────────────────────────────────────
  await visit(page, '/quick-book', 'Quick book commerce', { expectMinChars: 100, settle: 4000 });

  // ─── CMS STATIC PAGES ───────────────────────────────────────────────────
  await visit(page, '/about', 'About (CMS)', { expectMinChars: 80, settle: 3500 });
  await visit(page, '/faq', 'FAQ (CMS)', { expectMinChars: 80, settle: 3500 });
  await visit(page, '/travel-guides', 'Travel guides (CMS)', { expectMinChars: 80, settle: 3500 });

  // ─── AUTH SURFACES ──────────────────────────────────────────────────────
  await visit(page, '/auth/sign-in', 'Sign-in page', { expectMinChars: 60, settle: 3500 });
  await visit(page, '/auth/sign-up', 'Sign-up page', { expectMinChars: 60, settle: 3500 });

  // ─── ROLE-GATED BACK-OFFICE (should block anonymous) ────────────────────
  await visit(page, '/ops-console', 'Ops console gate', { expectMinChars: 40, settle: 3500 });
  await visit(page, '/supplier-portal', 'Supplier portal gate', { expectMinChars: 40, settle: 3500 });
  await visit(page, '/market-intelligence', 'Market intelligence gate', { expectMinChars: 40, settle: 3500 });

  // ─── INTERACTIONS on home ───────────────────────────────────────────────
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  await wait(4000);

  // Language switch (EN/AR)
  let langOk = false;
  try {
    const langBtn = page.locator('button').filter({ hasText: /^AR$|^ع$|العربية|English|^EN$/i }).first();
    if (await langBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await langBtn.click();
      await wait(1500);
      const htmlLang = await page.evaluate(() => document.documentElement.lang || '');
      const hasArabic = await page.evaluate(() => /[\u0600-\u06FF]/.test(document.body.innerText.slice(0, 2000)));
      langOk = htmlLang === 'ar' || hasArabic;
      // toggle back to English
      const backBtn = page.locator('button').filter({ hasText: /^EN$|^English$|العربية/i }).first();
      if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) await backBtn.click();
      await wait(1200);
    } else {
      record('Language switch (EN ⇄ AR)', false, 'toggle not found');
    }
  } catch (e) {
    record('Language switch (EN ⇄ AR)', false, String(e).slice(0, 100));
  }
  if (langOk) {
    record('Language switch (EN ⇄ AR)', true);
    await page.screenshot({ path: path.join(SHOT_DIR, 'lang-ar.png') });
  }

  // Theme selector (stable id: theme-selector-trigger-btn)
  try {
    // Dismiss any open navbar panel/menu first (e.g. left open by the lang toggle)
    await page.keyboard.press('Escape');
    await wait(600);
    const themeBtn = page.locator('#theme-selector-trigger-btn');
    if (await themeBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await themeBtn.click();
      await wait(1500);
      const dialogOpen = await page.locator('[role="dialog"][aria-label="Theme Selector"]').isVisible({ timeout: 3000 }).catch(() => false);
      if (dialogOpen) {
        // Switch to a different theme (stable ids: theme-option-<id>)
        const themeOptions = page.locator('[role="radio"]');
        const count = await themeOptions.count().catch(() => 0);
        const lagoon = page.locator('#theme-option-lagoon-breeze');
        let switched = false;
        if (await lagoon.isVisible({ timeout: 2500 }).catch(() => false)) {
          await lagoon.click({ timeout: 5000 });
          await wait(1200);
          switched = await lagoon.getAttribute('aria-checked').then((v) => v === 'true').catch(() => false);
        }
        record('Theme selector toggles', switched, `dialog opened, ${count} theme options`);
        await page.screenshot({ path: path.join(SHOT_DIR, 'theme-toggled.png') });
        await page.keyboard.press('Escape');
        await wait(600);
      } else {
        record('Theme selector toggles', false, 'dialog did not open');
      }
    } else {
      record('Theme selector toggles', false, 'theme button not found on home');
    }
  } catch (e) {
    record('Theme selector toggles', false, String(e).slice(0, 100));
  }

  // Search drawer (Cmd+K)
  try {
    await page.keyboard.press('Control+k');
    await wait(1500);
    const searchVisible = await page.evaluate(() => document.body.innerText.includes('Search') || document.body.innerText.includes('بحث'));
    const drawerShot = path.join(SHOT_DIR, 'search-drawer.png');
    await page.screenshot({ path: drawerShot });
    if (searchVisible) {
      record('Spotlight search drawer (Cmd+K)', true);
      await page.keyboard.press('Escape');
      await wait(800);
    } else {
      // Maybe the drawer has a different placeholder; check for modal overlay
      const modal = await page.locator('[role="dialog"]').count().catch(() => 0);
      record('Spotlight search drawer (Cmd+K)', modal > 0, modal > 0 ? 'dialog opened' : 'no search UI found');
      await page.keyboard.press('Escape');
    }
  } catch (e) {
    record('Spotlight search drawer (Cmd+K)', false, String(e).slice(0, 100));
  }

  // DayGi floating button visible on non-daygi routes
  await page.goto(BASE_URL + '/explore', { waitUntil: 'domcontentloaded' });
  await wait(3500);
  const daygiBtn = page.locator('button').filter({ hasText: /daygi|day gi|concierge/i }).first();
  record('DayGi floating launcher visible', await daygiBtn.isVisible({ timeout: 3000 }).catch(() => false));

  // ─── REPORT ─────────────────────────────────────────────────────────────
  console.log(`\n════════════════════════════════════════`);
  console.log(`RESULT: ${passed}/${total} checks passed`);
  const bad = results.filter((r) => !r.ok);
  if (bad.length) {
    console.log(`\nFailures:`);
    for (const r of bad) console.log(`  ❌ ${r.name}: ${r.detail}`);
  }
  console.log(`Screenshots: ${SHOT_DIR}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });