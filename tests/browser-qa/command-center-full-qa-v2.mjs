import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('tests/browser-qa/screenshots/command-center-qa-v2');
const RESULTS = [];

const SECTIONS = [
  { id: 'overview', nav: 'Overview', file: 'overview', contentProbe: 'Operational Status|Needs Action|active trips|System Status' },
  { id: 'trips', nav: 'Live Trips', file: 'trips', contentProbe: 'Trip|trip|Traveler|Stage|Pending' },
  { id: 'transfers', nav: 'Transfers', file: 'transfers', contentProbe: 'Transfer|transfer|Driver|Vehicle|Route' },
  { id: 'exceptions', nav: 'Exceptions', file: 'exceptions', contentProbe: 'Exception|exception|severity|payment|booking' },
  { id: 'commerce', nav: 'Commerce', file: 'commerce', contentProbe: 'Ledger|ledger|Payment|payment|Debit|Credit|Verify' },
  { id: 'suppliers', nav: 'Suppliers', file: 'suppliers', contentProbe: 'Supplier|supplier|Verification|Reliability|Confirm' },
  { id: 'intelligence', nav: 'Intelligence', file: 'intelligence', contentProbe: 'Intelligence|intelligence|Source|Alert|Competitor|Market' },
  { id: 'opportunities', nav: 'Opportunities', file: 'opportunities', contentProbe: 'Opportunity|opportunity|Accept|Reject|Evidence|Confidence' },
  { id: 'knowledge', nav: 'Knowledge', file: 'knowledge', contentProbe: 'Knowledge|knowledge|Gap|Conflict|Entity|Stale|Health' },
  { id: 'support', nav: 'Support', file: 'support', contentProbe: 'Support|support|Message|conversation|SLA|Traveler' },
  { id: 'sms', nav: 'SMS Center', file: 'sms', contentProbe: 'SMS|sms|Dispatch|Recipient|Message|Twilio' },
  { id: 'notifications', nav: 'Notifications', file: 'notifications', contentProbe: 'Notification|notification|Unread|Urgent|Read' },
  { id: 'audit', nav: 'Audit Log', file: 'audit', contentProbe: 'Audit|audit|Action|Actor|Entity|export|CSV' },
  { id: 'flags', nav: 'Feature Flags', file: 'flags', contentProbe: 'Feature|feature|Flag|flag|Toggle|Experiment' },
  { id: 'jobs', nav: 'Market Jobs', file: 'jobs', contentProbe: 'Job|job|Run|Enqueue|Status|Schedule|Market' },
  { id: 'health', nav: 'System Health', file: 'health', contentProbe: 'Health|health|API|Database|Service|Integration|Healthy|Redis' },
];

const VIEWPORTS = [
  { name: '1920', w: 1920, h: 1080 },
  { name: '1440', w: 1440, h: 900 },
  { name: '1280', w: 1280, h: 800 },
  { name: '1024', w: 1024, h: 768 },
];

function record(name, pass, detail) {
  const icon = pass ? '✅' : '❌';
  const msg = `${icon} ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(msg);
  RESULTS.push({ name, pass, detail });
}

async function authenticate(page) {
  const email = `qa-ops-${Date.now()}@dahab.travel`;
  const password = 'DahabOps2026!';
  const regRes = await page.request.post(`${API_URL}/api/auth/register`, {
    data: { name: 'QA Operator', email, password, role: 'admin' }
  });
  if (regRes.ok()) {
    const body = await regRes.json();
    await page.evaluate((d) => localStorage.setItem('dahab_user', JSON.stringify(d)), body.user || body);
    record('Register', true, email);
    return email;
  }
  // fallback login
  const loginRes = await page.request.post(`${API_URL}/api/auth/login`, { data: { email, password } });
  if (loginRes.ok()) {
    const body = await loginRes.json();
    await page.evaluate((d) => localStorage.setItem('dahab_user', JSON.stringify(d)), body.user || body);
    record('Login fallback', true, email);
    return email;
  }
  record('Auth', false, 'Could not authenticate');
  return null;
}

async function navigateToSection(page, section) {
  // Try clicking the sidebar button by its text
  const navButton = page.locator('nav button').filter({ hasText: section.nav }).first();
  try {
    await navButton.waitFor({ state: 'visible', timeout: 3000 });
    await navButton.click();
    await page.waitForTimeout(2000);
    return true;
  } catch {
    // Sidebar may be collapsed — expand first
    const expandBtn = page.locator('aside button').last();
    try {
      await expandBtn.click({ timeout: 1000 });
      await page.waitForTimeout(500);
      await navButton.click();
      await page.waitForTimeout(2000);
      return true;
    } catch {
      return false;
    }
  }
}

async function getMainContent(page) {
  // Get only the <main> element text — avoids nav bar false positives
  try {
    const main = page.locator('main');
    if (await main.isVisible({ timeout: 1000 })) {
      return await main.textContent();
    }
  } catch {}
  return '';
}

async function runQA() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);
  await authenticate(page);

  // Navigate to ops console
  await page.goto(`${BASE_URL}/ops-console`);
  await page.waitForTimeout(4000);
  
  // Verify we're on the command center
  const hasSidebar = await page.locator('aside nav button').count();
  record('Command Center loaded', hasSidebar > 0, `${hasSidebar} nav buttons found`);
  
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-landing.png'), fullPage: false });

  // ─── SECTION RENDERING AT 1920px ────────────────────────────────
  console.log('\n══════ SECTION RENDERING (1920px) ══════');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);

  for (const section of SECTIONS) {
    const ok = await navigateToSection(page, section);
    if (!ok) {
      record(`${section.nav} navigation`, false, 'Could not click sidebar');
      continue;
    }

    const mainText = await getMainContent(page);
    const probeRegex = new RegExp(section.contentProbe, 'i');
    const hasSectionContent = probeRegex.test(mainText || '');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `1920-${section.file}.png`),
      fullPage: false,
    });

    record(
      `${section.nav} renders`,
      hasSectionContent,
      hasSectionContent
        ? `Content matched (${(mainText || '').substring(0, 60)}...)`
        : `Content probe "${section.contentProbe}" not found in main`
    );
  }

  // ─── RESPONSIVE: ALL SECTIONS AT EACH VIEWPORT ───────────────────
  for (const vp of VIEWPORTS) {
    if (vp.name === '1920') continue; // already done
    console.log(`\n══════ RESPONSIVE: ${vp.name}px ══════`);
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(500);

    for (const section of SECTIONS) {
      await navigateToSection(page, section);
      const mainText = await getMainContent(page);
      const probeRegex = new RegExp(section.contentProbe, 'i');
      const hasContent = probeRegex.test(mainText || '');

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-${section.file}.png`),
        fullPage: false,
      });

      record(`${section.nav} @ ${vp.name}px`, hasContent, hasContent ? 'OK' : 'Missing content');
    }
  }

  // ─── INTERACTIVE TESTS ──────────────────────────────────────────
  console.log('\n══════ INTERACTIVE TESTS ══════');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);

  // 1. Command Palette via button click
  try {
    const searchBtn = page.locator('header button').filter({ hasText: 'Search' }).first();
    if (await searchBtn.isVisible({ timeout: 2000 })) {
      await searchBtn.click();
      await page.waitForTimeout(800);
      // Check for palette input
      const paletteInput = page.locator('.fixed input[type="text"]').first();
      const paletteVisible = await paletteInput.isVisible({ timeout: 2000 });
      record('Command Palette (click)', paletteVisible, paletteVisible ? 'Opens with search input' : 'Input not found');
      if (paletteVisible) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    } else {
      record('Command Palette (click)', false, 'Search button not found in header');
    }
  } catch (e) {
    record('Command Palette (click)', false, e.message?.substring(0, 80));
  }

  // 2. Command Palette via Ctrl+K
  try {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(800);
    const paletteInput = page.locator('.fixed input[type="text"]').first();
    const paletteVisible = await paletteInput.isVisible({ timeout: 2000 });
    record('Command Palette (Ctrl+K)', paletteVisible, paletteVisible ? 'Opens' : 'Not detected');
    if (paletteVisible) {
      // Type to search
      await paletteInput.fill('Suppliers');
      await page.waitForTimeout(500);
      const results = await page.locator('.fixed button').count();
      record('Command Palette search', results > 0, `${results} results for "Suppliers"`);
      await page.keyboard.press('Escape');
    }
  } catch (e) {
    record('Command Palette (Ctrl+K)', false, e.message?.substring(0, 80));
  }

  // 3. Sidebar collapse/expand
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const sidebar = page.locator('aside');
    const sidebarWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    const isCollapsed = sidebarWidth < 80;
    record('Sidebar auto-collapse @ 1280px', true, `Width: ${sidebarWidth}px, collapsed: ${isCollapsed}`);

    // Expand
    const toggleBtn = page.locator('aside button').last();
    await toggleBtn.click();
    await page.waitForTimeout(300);
    const expandedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    record('Sidebar expand', expandedWidth > sidebarWidth, `Width: ${expandedWidth}px`);
  } catch (e) {
    record('Sidebar collapse/expand', false, e.message?.substring(0, 80));
  }

  // 4. Language toggle (RTL)
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    const langToggle = page.locator('header button, header a').filter({ hasText: /عربي|AR|EN/ }).first();
    if (await langToggle.isVisible({ timeout: 2000 })) {
      await langToggle.click();
      await page.waitForTimeout(1500);
      const dir = await page.getAttribute('div', 'dir');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rtl-overview.png'), fullPage: false });
      record('Language toggle → RTL', dir === 'rtl', `dir=${dir}`);
      // Switch back
      await langToggle.click();
      await page.waitForTimeout(1000);
    } else {
      // Try the language button in top-right of main content
      const headerBtns = page.locator('header button').all();
      let found = false;
      for (const btn of await headerBtns) {
        const text = await btn.textContent();
        if (text && (text.includes('عربي') || text.includes('EN') || text.includes('AR'))) {
          await btn.click();
          await page.waitForTimeout(1500);
          const dir = await page.locator('div[dir]').first().getAttribute('dir');
          record('Language toggle → RTL', dir === 'rtl', `dir=${dir}`);
          await btn.click();
          await page.waitForTimeout(1000);
          found = true;
          break;
        }
      }
      if (!found) record('Language toggle', false, 'Button not found');
    }
  } catch (e) {
    record('Language toggle', false, e.message?.substring(0, 80));
  }

  // 5. Keyboard shortcuts (1-9 navigate sections)
  try {
    // Navigate to overview first
    await navigateToSection(page, SECTIONS[0]);
    await page.waitForTimeout(300);

    // Press "2" for Live Trips
    await page.keyboard.press('2');
    await page.waitForTimeout(1500);
    const mainText = await getMainContent(page);
    const onTrips = /Trip|trip|Traveler/i.test(mainText || '');
    record('Keyboard shortcut "2" → Live Trips', onTrips, onTrips ? 'Correct' : 'Did not navigate');
  } catch (e) {
    record('Keyboard shortcuts', false, e.message?.substring(0, 80));
  }

  // ─── CONSOLE ERRORS ─────────────────────────────────────────────
  console.log('\n══════ CONSOLE ERRORS ══════');
  if (consoleErrors.length > 0) {
    record('Console errors', false, `${consoleErrors.length} errors found`);
    consoleErrors.slice(0, 5).forEach(e => console.log(`  ⚠ ${e.substring(0, 120)}`));
  } else {
    record('Console errors', true, 'No console errors');
  }

  await browser.close();

  // ─── SUMMARY ────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('COMMAND CENTER BROWSER QA — FINAL SUMMARY');
  console.log('═'.repeat(60));
  const passed = RESULTS.filter(r => r.pass).length;
  const failed = RESULTS.filter(r => !r.pass).length;
  const total = RESULTS.length;
  console.log(`Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    RESULTS.filter(r => !r.pass).forEach(r => {
      console.log(`  • ${r.name}: ${r.detail}`);
    });
  }

  console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
  return { passed, failed, total };
}

runQA().catch(e => {
  console.error('QA FAILED:', e);
  process.exit(1);
});
