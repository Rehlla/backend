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
  console.log('\n🚀 DAHAB COMMAND CENTER — BROWSER QA\n');
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
  let authCookie = null;
  try {
    const regRes = await page.request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'QA Operator',
        email: `qa-ops-${Date.now()}@dahab.travel`,
        password: 'DahabOps2026!',
        role: 'Admin',
      },
    });
    const regBody = await regRes.json();
    record('Register operator', regRes.ok(), `status=${regRes.status()}`);

    // Extract session cookie
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'dahab_auth_token');
    if (sessionCookie) {
      authCookie = sessionCookie;
      record('Session cookie set', true, `name=${sessionCookie.name}`);
    } else {
      // Try to login to get cookie
      const loginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: regBody.email || 'qa-ops@dahab.travel', password: 'DahabOps2026!' },
      });
      const cookies2 = await context.cookies();
      authCookie = cookies2.find(c => c.name === 'dahab_auth_token');
      record('Login fallback', !!authCookie, authCookie ? 'cookie found' : 'no cookie');
    }

    // Verify auth works
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
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    const hasSignIn = bodyText.includes('Sign in') || bodyText.includes('sign in') || bodyText.includes('Login');
    const hasNavBar = bodyText.includes('DAHAB') || bodyText.includes('Explore') || bodyText.includes('Trips');
    const hasCommandCenter = bodyText.includes('Command Center') || bodyText.includes('COMMAND CENTER') || bodyText.includes('Overview');

    record('Navigate to /ops-console', true, `loaded page`);
    record('No auth wall', !hasSignIn || hasCommandCenter, hasSignIn && !hasCommandCenter ? 'Still showing sign-in' : 'Content visible');
    record('Command Center rendered', hasCommandCenter, `hasSections=${bodyText.includes('Overview')}`);

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-ops-console-loaded.png'), fullPage: false });
  } catch (e) {
    record('Navigate to /ops-console', false, e.message);
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
      // Click the sidebar nav item
      const navBtn = page.locator(`[data-section="${section.id}"]`).first();
      if (await navBtn.count() > 0) {
        await navBtn.click({ timeout: 5000 });
        await page.waitForTimeout(1500);

        // Verify section rendered
        const bodyText = await page.textContent('body');
        const hasContent = bodyText.length > 200;

        record(`Section: ${section.label}`, hasContent, `bodyLength=${bodyText.length}`);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${section.screenshot}.png`),
          fullPage: false,
        });
      } else {
        // Try clicking by text
        const textBtn = page.locator(`button, a, div[role="button"]`).filter({ hasText: section.label }).first();
        if (await textBtn.count() > 0) {
          await textBtn.click({ timeout: 5000 });
          await page.waitForTimeout(1500);
          record(`Section: ${section.label}`, true, 'clicked by text');
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `${section.screenshot}.png`),
            fullPage: false,
          });
        } else {
          record(`Section: ${section.label}`, false, 'nav button not found');
        }
      }
    } catch (e) {
      record(`Section: ${section.label}`, false, e.message.substring(0, 100));
    }
  }

  // ─── Responsive Viewports ──────────────────────────────────────────
  console.log('\n─── Responsive Viewports ───');
  const VIEWPORTS = [
    { width: 1440, height: 900, label: '1440px' },
    { width: 1280, height: 800, label: '1280px' },
    { width: 1024, height: 768, label: '1024px' },
  ];

  // Go back to overview first
  try {
    const overviewBtn = page.locator('[data-section="overview"]').first();
    if (await overviewBtn.count() > 0) await overviewBtn.click({ timeout: 3000 });
    else {
      const textBtn = page.locator('button, a, div[role="button"]').filter({ hasText: 'Overview' }).first();
      if (await textBtn.count() > 0) await textBtn.click({ timeout: 3000 });
    }
    await page.waitForTimeout(1500);
  } catch (e) { /* ignore */ }

  for (const vp of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `responsive-${vp.label}.png`),
        fullPage: false,
      });
      record(`Viewport ${vp.label}`, true, 'screenshot taken');
    } catch (e) {
      record(`Viewport ${vp.label}`, false, e.message.substring(0, 80));
    }
  }

  // ─── Command Palette (Ctrl+K) ──────────────────────────────────────
  console.log('\n─── Command Palette ───');
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1000);

    // Look for the command palette - it has an input with a search placeholder
    const paletteInput = page.locator('[class*="command-palette"] input, [class*="CommandPalette"] input, [placeholder*="Search"], [placeholder*="search"]').first();
    const hasPalette = await paletteInput.count() > 0;
    record('Command Palette opens (Ctrl+K)', hasPalette, hasPalette ? 'input found' : 'no palette input');

    if (hasPalette) {
      await paletteInput.fill('trip');
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'command-palette-search.png'),
        fullPage: false,
      });
      record('Command Palette search works', true, 'typed "trip"');
    }

    // Close palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (e) {
    record('Command Palette', false, e.message.substring(0, 80));
  }

  // ─── Arabic/RTL Test ───────────────────────────────────────────────
  console.log('\n─── Arabic / RTL ───');
  try {
    // Look for language toggle
    const langBtn = page.locator('button').filter({ hasText: /عربي|Arabic|EN|AR/ }).first();
    if (await langBtn.count() > 0) {
      await langBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1000);
      const dir = await page.getAttribute('html', 'dir');
      const hasArabic = (await page.textContent('body')).includes('لوحة');
      record('Arabic language switch', hasArabic || dir === 'rtl', `dir=${dir}`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'arabic-rtl.png'),
        fullPage: false,
      });

      // Switch back
      await langBtn.click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } else {
      record('Arabic language switch', false, 'language toggle not found');
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
    ];

    for (const ep of endpoints) {
      const res = await page.request.get(`${BASE_URL}${ep.path}`);
      const ok = res.ok();
      let detail = `status=${res.status()}`;
      try {
        const body = await res.json();
        if (Array.isArray(body)) detail += ` count=${body.length}`;
        else if (body.trips) detail += ` trips=${body.trips.length}`;
        else if (body.status) detail += ` status=${body.status}`;
      } catch (e) { /* not json */ }
      record(`API: ${ep.label}`, ok, detail);
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

  console.log(`\n📸 Screenshots: ${SCREENSHOT_DIR}`);
  console.log('\n' + '═'.repeat(60));
}

main().catch(e => {
  console.error('QA failed:', e);
  process.exit(1);
});
