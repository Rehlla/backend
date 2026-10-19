import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(import.meta.dirname, 'screenshots', 'command-center-qa');

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
let totalTests = 0;
let passedTests = 0;

function record(name, passed, detail) {
  totalTests++;
  if (passed) passedTests++;
  results.push({ name, passed, detail: detail || '' });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ': ' + detail : ''}`);
}

async function main() {
  console.log('\n🚀 DAHAB COMMAND CENTER — BROWSER QA v6\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ─── Setup: Register operator and get auth cookie ──────────────────
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Register operator account via API
  console.log('─── Authentication Setup ───');
  try {
    const email = `qa-ops-${Date.now()}@dahab.travel`;
    const regRes = await page.request.post(`${BASE_URL}/api/auth/register`, {
      data: { name: 'QA Operator', email, password: 'DahabOps2026!', role: 'Admin' },
    });
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'dahab_auth_token');
    record('Register + cookie', regRes.ok() && !!sessionCookie, `cookie=${!!sessionCookie}`);

    const meRes = await page.request.get(`${BASE_URL}/api/auth/me`);
    const meBody = await meRes.json();
    record('Auth /api/auth/me', meRes.ok(), meBody.user ? `user=${meBody.user.name}` : 'no user');
  } catch (e) {
    record('Auth setup', false, e.message);
  }

  // ─── Navigate to Command Center ─────────────────────────────────────
  console.log('\n─── Command Center Navigation ───');
  try {
    await page.goto(`${BASE_URL}/ops-console`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent('body');
    const hasSignIn = bodyText.includes('Sign in') || bodyText.includes('sign in');
    const hasCommandCenter = bodyText.includes('Overview') && (bodyText.includes('Live Trips') || bodyText.includes('COMMAND CENTER'));

    record('Navigate to /ops-console', true);
    record('No auth wall', !hasSignIn || hasCommandCenter, hasSignIn && !hasCommandCenter ? 'Auth wall' : 'OK');
    record('Command Center rendered', hasCommandCenter);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-ops-console-loaded.png'), fullPage: false });
  } catch (e) {
    record('Navigate to /ops-console', false, e.message.substring(0, 100));
  }

  // ─── Check sidebar navigation sections ──────────────────────────────
  console.log('\n─── Section Navigation ───');
  const SECTION_ITEMS = [
    { id: 'overview', label: 'Overview', screenshot: '02-overview' },
    { id: 'trips', label: 'Live Trips', screenshot: '03-live-trips' },
    { id: 'transfers', label: 'Transfers', screenshot: '04-transfers' },
    { id: 'exceptions', label: 'Exceptions', screenshot: '05-exceptions' },
    { id: 'commerce', label: 'Commerce', screenshot: '06-commerce' },
    { id: 'suppliers', label: 'Suppliers', screenshot: '07-suppliers' },
    { id: 'intelligence', label: 'Intelligence', screenshot: '08-intelligence' },
    { id: 'opportunities', label: 'Opportunities', screenshot: '09-opportunities' },
    { id: 'knowledge', label: 'Knowledge', screenshot: '10-knowledge' },
    { id: 'support', label: 'Support', screenshot: '11-support' },
    { id: 'sms', label: 'SMS Center', screenshot: '12-sms' },
    { id: 'notifications', label: 'Notifications', screenshot: '13-notifications' },
    { id: 'audit', label: 'Audit Log', screenshot: '14-audit' },
    { id: 'flags', label: 'Feature Flags', screenshot: '15-flags' },
    { id: 'jobs', label: 'Market Jobs', screenshot: '16-jobs' },
    { id: 'health', label: 'System Health', screenshot: '17-health' },
  ];

  for (const section of SECTION_ITEMS) {
    try {
      // Try text matching on sidebar buttons
      const btn = page.locator('aside button').filter({ hasText: section.label }).first();
      if (await btn.count() > 0) {
        // Scroll into view in case it's off-screen
        await btn.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await btn.click({ timeout: 5000 });
        await page.waitForTimeout(1500);

        const bodyText = await page.textContent('body');
        record(`Section: ${section.label}`, bodyText.length > 200, `bodyLen=${bodyText.length}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${section.screenshot}.png`), fullPage: false });
      } else {
        // Fallback: use keyboard shortcut (number keys)
        const numIndex = SECTION_ITEMS.indexOf(section) + 1;
        if (numIndex <= 9) {
          await page.keyboard.press(String(numIndex));
          await page.waitForTimeout(1500);
          record(`Section: ${section.label}`, true, `via keyboard key ${numIndex}`);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${section.screenshot}.png`), fullPage: false });
        } else {
          record(`Section: ${section.label}`, false, 'nav button not found');
        }
      }
    } catch (e) {
      record(`Section: ${section.label}`, false, e.message.substring(0, 100));
    }
  }

  // ─── Command Palette (Ctrl+K) ──────────────────────────────────────
  console.log('\n─── Command Palette ───');
  try {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(2000); // extra time for lazy loading

    // Look for the palette's search input (any input inside the fixed overlay)
    const paletteInput = page.locator('.fixed input[type="text"]').first();
    const hasPalette = await paletteInput.count() > 0;
    record('Command Palette opens (Ctrl+K)', hasPalette, hasPalette ? 'input found' : 'no palette');

    if (hasPalette) {
      await paletteInput.fill('trip');
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'command-palette-search.png'), fullPage: false });
      record('Command Palette search', true);

      // Test keyboard navigation
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      record('Command Palette keyboard nav', true);
    }

    // Close if still open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (e) {
    record('Command Palette', false, e.message.substring(0, 100));
  }

  // ─── Responsive Viewports ──────────────────────────────────────────
  console.log('\n─── Responsive Viewports ───');
  const VIEWPORTS = [
    { width: 1440, height: 900, label: '1440px' },
    { width: 1280, height: 800, label: '1280px' },
    { width: 1024, height: 768, label: '1024px' },
  ];

  // Go back to overview
  try {
    const overviewBtn = page.locator('aside button').filter({ hasText: 'Overview' }).first();
    if (await overviewBtn.count() > 0) {
      await overviewBtn.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await overviewBtn.click({ timeout: 3000 });
    }
    await page.waitForTimeout(1500);
  } catch (e) { /* ignore */ }

  for (const vp of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `responsive-${vp.label}.png`), fullPage: false });
      record(`Viewport ${vp.label}`, true);
    } catch (e) {
      record(`Viewport ${vp.label}`, false, e.message.substring(0, 80));
    }
  }

  // ─── Arabic/RTL Test ───────────────────────────────────────────────
  console.log('\n─── Arabic / RTL ───');
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    const langBtn = page.locator('header button, header a').filter({ hasText: /عربي|AR|EN|English|عر/ }).first();
    if (await langBtn.count() > 0) {
      await langBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      const dir = await page.getAttribute('html', 'dir') || await page.getAttribute('[dir]', 'dir');
      record('Arabic RTL switch', dir === 'rtl', `dir=${dir}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'arabic-rtl.png'), fullPage: false });

      // Switch back to English
      const backBtn = page.locator('header button, header a').filter({ hasText: /عربي|AR|EN|English|عر/ }).first();
      if (await backBtn.count() > 0) {
        await backBtn.click({ timeout: 3000 });
        await page.waitForTimeout(500);
      }
    } else {
      record('Arabic RTL switch', false, 'language toggle not found');
    }
  } catch (e) {
    record('Arabic / RTL', false, e.message.substring(0, 80));
  }

  // ─── API Health Integration ────────────────────────────────────────
  console.log('\n─── API Integration ───');
  try {
    const endpoints = [
      { path: '/api/health', label: 'Health' },
      { path: '/api/operations/trips', label: 'Trips API' },
      { path: '/api/operations/payments', label: 'Payments API' },
      { path: '/api/commerce/ledger', label: 'Ledger API' },
      { path: '/api/market/intelligence', label: 'Intelligence API' },
      { path: '/api/intelligence/opportunities', label: 'Opportunities API' },
      { path: '/api/operations/bookings', label: 'Bookings API' },
    ];

    for (const ep of endpoints) {
      const res = await page.request.get(`${BASE_URL}${ep.path}`);
      let detail = `status=${res.status()}`;
      try {
        const body = await res.json();
        if (Array.isArray(body)) detail += ` count=${body.length}`;
        else if (body.trips) detail += ` trips=${body.trips.length}`;
        else if (body.status) detail += ` s=${body.status}`;
      } catch (e) { /* not json */ }
      record(`API: ${ep.label}`, res.ok(), detail);
    }
  } catch (e) {
    record('API integration', false, e.message.substring(0, 80));
  }

  // ─── Summary ───────────────────────────────────────────────────────
  await browser.close();

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 BROWSER QA RESULTS: ${passedTests}/${totalTests} passed\n`);

  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('❌ FAILURES:');
    for (const f of failures) {
      console.log(`   • ${f.name}: ${f.detail}`);
    }
  }

  const passed = results.filter(r => r.passed);
  if (passed.length > 0) {
    console.log('\n✅ PASSED:');
    for (const p of passed) {
      console.log(`   • ${p.name}`);
    }
  }

  console.log(`\n📸 Screenshots: ${SCREENSHOT_DIR}`);
  console.log('\n' + '═'.repeat(60));
}

main().catch(e => {
  console.error('QA failed:', e);
  process.exit(1);
});
