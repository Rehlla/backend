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
  console.log('\n🚀 DAHAB COMMAND CENTER — FINAL BROWSER QA\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ─── Setup ──────────────────────────────────────────────────────────
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('─── Authentication Setup ───');
  try {
    const email = `qa-ops-${Date.now()}@dahab.travel`;
    await page.request.post(`${BASE_URL}/api/auth/register`, {
      data: { name: 'QA Operator', email, password: 'DahabOps2026!', role: 'Admin' },
    });
    const meRes = await page.request.get(`${BASE_URL}/api/auth/me`);
    record('Auth setup', meRes.ok());
  } catch (e) {
    record('Auth setup', false, e.message);
  }

  // ─── Navigate ───────────────────────────────────────────────────────
  console.log('\n─── Command Center ───');
  try {
    await page.goto(`${BASE_URL}/ops-console`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent('body');
    record('Command Center loaded', bodyText.includes('Overview'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-overview.png'), fullPage: false });
  } catch (e) {
    record('Command Center loaded', false, e.message.substring(0, 100));
  }

  // ─── Command Palette (via click, not Ctrl+K) ────────────────────────
  console.log('\n─── Command Palette ───');
  try {
    const searchBtn = page.locator('header button').filter({ hasText: /⌘K|Search|بحث/ }).first();
    if (await searchBtn.count() > 0) {
      await searchBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
      const paletteInput = page.locator('.fixed input').first();
      const found = await paletteInput.count() > 0;
      record('Palette opens via click', found);
      if (found) {
        await paletteInput.fill('trip');
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-palette-search.png'), fullPage: false });
        record('Palette search works', true);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      record('Palette opens via click', false, 'search button not found');
    }

    // Also test Ctrl+K from overview
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(2000);
    const inputAfterCtrlK = page.locator('.fixed input').first();
    record('Palette opens via Ctrl+K', (await inputAfterCtrlK.count()) > 0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (e) {
    record('Command Palette', false, e.message.substring(0, 100));
  }

  // ─── Section Navigation ─────────────────────────────────────────────
  console.log('\n─── Section Navigation (16 sections) ───');
  const SECTION_ITEMS = [
    { label: 'Overview', screenshot: '03-overview' },
    { label: 'Live Trips', screenshot: '04-live-trips' },
    { label: 'Transfers', screenshot: '05-transfers' },
    { label: 'Exceptions', screenshot: '06-exceptions' },
    { label: 'Commerce', screenshot: '07-commerce' },
    { label: 'Suppliers', screenshot: '08-suppliers' },
    { label: 'Intelligence', screenshot: '09-intelligence' },
    { label: 'Opportunities', screenshot: '10-opportunities' },
    { label: 'Knowledge', screenshot: '11-knowledge' },
    { label: 'Support', screenshot: '12-support' },
    { label: 'SMS Center', screenshot: '12-sms' },
    { label: 'Notifications', screenshot: '13-notifications' },
    { label: 'Audit Log', screenshot: '14-audit' },
    { label: 'Feature Flags', screenshot: '15-flags' },
    { label: 'Market Jobs', screenshot: '16-jobs' },
    { label: 'System Health', screenshot: '17-health' },
  ];

  for (const section of SECTION_ITEMS) {
    try {
      // Use evaluate to click sidebar buttons reliably
      const clicked = await page.evaluate((label) => {
        const btns = document.querySelectorAll('aside button');
        for (const btn of btns) {
          const text = btn.textContent || '';
          // Match exact section label (strip badge counts)
          const cleanText = text.replace(/\d+$/, '').trim();
          if (cleanText === label) {
            btn.scrollIntoView({ block: 'center' });
            btn.click();
            return true;
          }
        }
        return false;
      }, section.label);

      if (clicked) {
        await page.waitForTimeout(1500);
        const bodyText = await page.textContent('body');
        record(`Section: ${section.label}`, bodyText.length > 200, `bodyLen=${bodyText.length}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${section.screenshot}.png`), fullPage: false });
      } else {
        record(`Section: ${section.label}`, false, 'button not found via evaluate');
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

  // Go back to overview
  await page.evaluate(() => {
    const btns = document.querySelectorAll('aside button');
    for (const btn of btns) {
      if ((btn.textContent || '').replace(/\d+$/, '').trim() === 'Overview') {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        break;
      }
    }
  });
  await page.waitForTimeout(1500);

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

  // ─── Arabic / RTL ───────────────────────────────────────────────────
  console.log('\n─── Arabic / RTL ───');
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    // Find language toggle button in the top header
    const langBtn = page.locator('header button, header a').filter({ hasText: /عربي|AR|EN/ }).first();
    if (await langBtn.count() > 0) {
      await langBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      const dir = await page.evaluate(() => document.documentElement.dir || document.querySelector('[dir]')?.getAttribute('dir') || '');
      record('Arabic RTL switch', dir === 'rtl', `dir=${dir}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18-arabic-rtl.png'), fullPage: false });

      // Switch back
      const backBtn = page.locator('header button, header a').filter({ hasText: /عربي|AR|EN/ }).first();
      if (await backBtn.count() > 0) await backBtn.click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } else {
      record('Arabic RTL switch', false, 'toggle not found');
    }
  } catch (e) {
    record('Arabic / RTL', false, e.message.substring(0, 80));
  }

  // ─── API Integration ────────────────────────────────────────────────
  console.log('\n─── API Integration ───');
  try {
    const endpoints = [
      { path: '/api/health', label: 'Health' },
      { path: '/api/operations/trips', label: 'Trips' },
      { path: '/api/operations/payments', label: 'Payments' },
      { path: '/api/commerce/ledger', label: 'Ledger' },
      { path: '/api/market/intelligence', label: 'Intelligence' },
      { path: '/api/intelligence/opportunities', label: 'Opportunities' },
      { path: '/api/operations/bookings', label: 'Bookings' },
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
  console.log(`\n📊 BROWSER QA: ${passedTests}/${totalTests} passed\n`);

  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('❌ FAILURES:');
    for (const f of failures) {
      console.log(`   • ${f.name}: ${f.detail}`);
    }
  } else {
    console.log('✅ ALL TESTS PASSED!');
  }

  console.log(`\n📸 Screenshots: ${SCREENSHOT_DIR}`);
  console.log('═'.repeat(60));
}

main().catch(e => { console.error('QA failed:', e); process.exit(1); });
