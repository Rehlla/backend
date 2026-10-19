import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('tests/browser-qa/screenshots/command-center-qa-v3');
const RESULTS = [];

const SECTIONS = [
  { id: 'overview', nav: 'Overview', file: 'overview', probe: 'Operational|Status|Needs Action|System Status|Loading' },
  { id: 'trips', nav: 'Live Trips', file: 'trips', probe: 'Trip|trip|Traveler|Stage|Pending|Loading' },
  { id: 'transfers', nav: 'Transfers', file: 'transfers', probe: 'Transfer|transfer|Driver|Vehicle|Route|Loading' },
  { id: 'exceptions', nav: 'Exceptions', file: 'exceptions', probe: 'Exception|exception|severity|payment|booking|Loading' },
  { id: 'commerce', nav: 'Commerce', file: 'commerce', probe: 'Ledger|ledger|Payment|payment|Debit|Credit|Verify|Loading' },
  { id: 'suppliers', nav: 'Suppliers', file: 'suppliers', probe: 'Supplier|supplier|Verification|Reliability|Confirm|Loading' },
  { id: 'intelligence', nav: 'Intelligence', file: 'intelligence', probe: 'Intelligence|intelligence|Source|Alert|Competitor|Market|Loading' },
  { id: 'opportunities', nav: 'Opportunities', file: 'opportunities', probe: 'Opportunity|opportunity|Accept|Reject|Evidence|Confidence|Loading' },
  { id: 'knowledge', nav: 'Knowledge', file: 'knowledge', probe: 'Knowledge|knowledge|Gap|Conflict|Entity|Stale|Health|Loading' },
  { id: 'support', nav: 'Support', file: 'support', probe: 'Support|support|Message|conversation|SLA|Traveler|Loading' },
  { id: 'sms', nav: 'SMS Center', file: 'sms', probe: 'SMS|sms|Dispatch|Recipient|Message|Twilio|Loading' },
  { id: 'notifications', nav: 'Notifications', file: 'notifications', probe: 'Notification|notification|Unread|Urgent|Read|Loading' },
  { id: 'audit', nav: 'Audit Log', file: 'audit', probe: 'Audit|audit|Action|Actor|Entity|export|CSV|Loading' },
  { id: 'flags', nav: 'Feature Flags', file: 'flags', probe: 'Feature|feature|Flag|flag|Toggle|Experiment|Loading' },
  { id: 'jobs', nav: 'Market Jobs', file: 'jobs', probe: 'Job|job|Run|Enqueue|Status|Schedule|Market|Loading' },
  { id: 'health', nav: 'System Health', file: 'health', probe: 'Health|health|API|Database|Service|Integration|Healthy|Loading' },
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

async function ensureAccountAndLogin(page) {
  // Step 1: Register a fresh account via API (sets cookie if backend auto-logs-in)
  const email = `qa-ops-${Date.now()}@dahab.travel`;
  const password = 'DahabOps2026!';

  const regRes = await page.request.post(`${API_URL}/api/auth/register`, {
    data: { name: 'QA Operator', email, password, role: 'admin' }
  });
  const regBody = regRes.ok() ? await regRes.json() : null;
  if (regBody) {
    record('Register account', true, email);
  } else {
    record('Register account', false, `Status: ${regRes.status()}`);
  }

  // Step 2: Login through the browser UI to get the HttpOnly session cookie
  await page.goto(`${BASE_URL}/auth/sign-in`);
  await page.waitForTimeout(2000);

  // Fill in email + password and submit
  try {
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill(email);
    await passInput.fill(password);

    // Click sign-in button
    const signInBtn = page.locator('button[type="submit"], button').filter({ hasText: /sign.?in|login|دخول/i }).first();
    await signInBtn.click();

    // Wait for navigation to complete
    await page.waitForTimeout(3000);

    // Verify we're signed in by checking session
    const meRes = await page.request.get(`${API_URL}/api/auth/me`);
    if (meRes.ok()) {
      const meBody = await meRes.json();
      record('Login (browser)', true, meBody?.user?.email || 'authenticated');
      return true;
    }
  } catch (e) {
    record('Login (browser)', false, e.message?.substring(0, 100));
  }

  // Fallback: Try direct API login which should set the cookie
  try {
    const loginRes = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email, password }
    });
    if (loginRes.ok()) {
      // The API sets a Set-Cookie header, but page.request won't persist it.
      // We need to extract the cookie and set it manually.
      const headers = loginRes.headers();
      const setCookie = headers['set-cookie'];
      if (setCookie) {
        // Parse cookies and add them to the page context
        const cookies = setCookie.split(',').map(c => c.trim().split(';')[0]);
        for (const cookie of cookies) {
          const [name, value] = cookie.split('=');
          if (name && value) {
            await context.addCookies([{
              name: name.trim(),
              value: value.trim(),
              domain: 'localhost',
              path: '/',
            }]);
          }
        }
      }
      record('Login (API fallback)', true, email);
      return true;
    }
  } catch (e) {
    record('Login (API fallback)', false, e.message?.substring(0, 100));
  }

  record('Authentication', false, 'Failed to establish session');
  return false;
}

let context; // Global so fallback cookie setting can use it

async function runQA() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // ─── AUTHENTICATION ────────────────────────────────────────────
  console.log('══════ AUTHENTICATION ══════');
  const authed = await ensureAccountAndLogin(page);
  if (!authed) {
    console.log('\n⚠ Trying direct navigation (maybe session was already set)...');
  }

  // ─── NAVIGATE TO OPS CONSOLE ──────────────────────────────────
  console.log('\n══════ OPS CONSOLE ══════');
  await page.goto(`${BASE_URL}/ops-console`);
  await page.waitForTimeout(5000);

  // Take a diagnostic screenshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-landing.png'), fullPage: false });

  // Check what's on the page
  const bodyText = await page.textContent('body') || '';
  const url = page.url();
  console.log(`URL: ${url}`);
  console.log(`Body preview: ${bodyText.substring(0, 200)}`);

  // Check if we're blocked by RequireRole
  if (bodyText.includes('Sign in required') || bodyText.includes('do not have access')) {
    console.log('\n⚠ Blocked by RequireRole — session not established. Trying UI login...');

    // Go to sign-in page and login through the actual UI form
    await page.goto(`${BASE_URL}/auth/sign-in`);
    await page.waitForTimeout(3000);

    // Take screenshot of sign-in page
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-signin-page.png'), fullPage: false });

    // Try to find and fill the login form
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input fields`);
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type');
      const placeholder = await inputs[i].getAttribute('placeholder');
      const name = await inputs[i].getAttribute('name');
      console.log(`  Input ${i}: type=${type}, name=${name}, placeholder=${placeholder}`);
    }

    // Try filling email + password
    try {
      const emailInput = page.locator('input[type="email"]').first();
      const passInput = page.locator('input[type="password"]').first();

      if (await emailInput.isVisible({ timeout: 3000 }) && await passInput.isVisible({ timeout: 3000 })) {
        // First register through the form
        // Switch to sign-up if needed
        const signUpLink = page.locator('button, a').filter({ hasText: /sign.?up|create.*account|register|حساب جديد/i }).first();
        if (await signUpLink.isVisible({ timeout: 2000 })) {
          await signUpLink.click();
          await page.waitForTimeout(1000);
        }

        // Fill registration form
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();

        const email = `qa-ops-${Date.now()}@dahab.travel`;

        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill('QA Operator');
        }
        await emailInput.fill(email);
        if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await phoneInput.fill('+201234567890');
        }
        await passInput.fill('DahabOps2026!');

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-signin-filled.png'), fullPage: false });

        // Submit
        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();
        await page.waitForTimeout(5000);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-after-submit.png'), fullPage: false });

        // Now navigate to ops console
        await page.goto(`${BASE_URL}/ops-console`);
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-ops-console.png'), fullPage: false });

        const newBody = await page.textContent('body') || '';
        console.log(`After login body: ${newBody.substring(0, 200)}`);
      }
    } catch (e) {
      console.log('Form fill error:', e.message);
    }
  }

  // Check if we have the Command Center now
  const finalBody = await page.textContent('body') || '';
  const hasNavButtons = await page.locator('nav button').count();
  console.log(`\nNav buttons found: ${hasNavButtons}`);
  console.log(`Body preview: ${finalBody.substring(0, 300)}`);

  // ─── SECTION RENDERING TESTS ──────────────────────────────────
  if (hasNavButtons > 0) {
    console.log('\n══════ SECTION RENDERING (1920px) ══════');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    for (const section of SECTIONS) {
      try {
        const btn = page.locator('nav button').filter({ hasText: section.nav }).first();
        await btn.waitFor({ state: 'visible', timeout: 3000 });
        await btn.click();
        await page.waitForTimeout(2000);

        const main = page.locator('main');
        const mainText = await main.isVisible({ timeout: 1000 }) ? await main.textContent() : '';
        const probeRegex = new RegExp(section.probe, 'i');
        const hasContent = probeRegex.test(mainText || '');

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `1920-${section.file}.png`),
          fullPage: false,
        });

        record(`${section.nav} renders`, hasContent, hasContent ? 'OK' : `probe mismatch`);
      } catch (e) {
        record(`${section.nav} renders`, false, e.message?.substring(0, 80));
      }
    }

    // ─── RESPONSIVE TESTS ─────────────────────────────────────────
    for (const vp of VIEWPORTS) {
      if (vp.name === '1920') continue;
      console.log(`\n══════ RESPONSIVE: ${vp.name}px ══════`);
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.waitForTimeout(500);

      for (const section of SECTIONS) {
        try {
          const btn = page.locator('nav button').filter({ hasText: section.nav }).first();
          await btn.waitFor({ state: 'visible', timeout: 2000 });
          await btn.click();
          await page.waitForTimeout(1500);

          const main = page.locator('main');
          const mainText = await main.isVisible({ timeout: 1000 }) ? await main.textContent() : '';
          const probeRegex = new RegExp(section.probe, 'i');
          const hasContent = probeRegex.test(mainText || '');

          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `${vp.name}-${section.file}.png`),
            fullPage: false,
          });

          record(`${section.nav} @ ${vp.name}px`, hasContent, hasContent ? 'OK' : 'Missing');
        } catch (e) {
          record(`${section.nav} @ ${vp.name}px`, false, e.message?.substring(0, 80));
        }
      }
    }

    // ─── INTERACTIVE TESTS ────────────────────────────────────────
    console.log('\n══════ INTERACTIVE TESTS ══════');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    // Command Palette via header button
    try {
      const searchBtn = page.locator('header button').filter({ hasText: /Search|⌘K|search/i }).first();
      if (await searchBtn.isVisible({ timeout: 2000 })) {
        await searchBtn.click();
        await page.waitForTimeout(800);
        const paletteInput = page.locator('.fixed input[type="text"]').first();
        const paletteVisible = await paletteInput.isVisible({ timeout: 2000 });
        record('Command Palette (click)', paletteVisible, paletteVisible ? 'Opens' : 'Not found');
        if (paletteVisible) await page.keyboard.press('Escape');
      } else {
        record('Command Palette (click)', false, 'Search button not in header');
      }
    } catch (e) {
      record('Command Palette (click)', false, e.message?.substring(0, 80));
    }

    // Sidebar collapse
    try {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(1000);
      const sidebar = page.locator('aside');
      const sidebarWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
      record('Sidebar auto-collapse @ 1280px', sidebarWidth < 80, `Width: ${sidebarWidth}px`);
    } catch (e) {
      record('Sidebar collapse', false, e.message?.substring(0, 80));
    }

    // Language toggle
    try {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(300);
      // Find button with "عربي" or language-related text in the top bar area
      const allBtns = page.locator('button').all();
      let langFound = false;
      for (const btn of await allBtns) {
        const text = await btn.textContent().catch(() => '');
        if (text && (text.includes('عربي') || text.match(/\bAR\b/) || text.match(/\bEN\b/))) {
          await btn.click();
          await page.waitForTimeout(1500);
          const dir = await page.locator('div[dir]').first().getAttribute('dir');
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'rtl-overview.png'), fullPage: false });
          record('Language toggle → RTL', dir === 'rtl', `dir=${dir}`);
          await btn.click();
          await page.waitForTimeout(500);
          langFound = true;
          break;
        }
      }
      if (!langFound) record('Language toggle', false, 'Button not found');
    } catch (e) {
      record('Language toggle', false, e.message?.substring(0, 80));
    }
  } else {
    console.log('\n⚠ No nav buttons found — Command Center did not render.');
    console.log('Dumping page HTML for diagnosis...');

    // Take diagnostic screenshots
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'diagnostic-full.png'), fullPage: true });

    // Check if we got redirected
    console.log(`Final URL: ${page.url()}`);

    // Check if there's a "Sign in" or "Access Denied" message
    if (finalBody.includes('Sign in')) {
      record('Auth gate', false, 'Showing "Sign in" screen');
    } else if (finalBody.includes('do not have access')) {
      record('Auth gate', false, 'Showing "no access" — role mismatch');
    } else {
      record('Command Center render', false, 'Unknown state');
    }
  }

  // ─── CONSOLE ERRORS ───────────────────────────────────────────
  console.log('\n══════ CONSOLE ERRORS ══════');
  if (consoleErrors.length > 0) {
    record('Console errors', false, `${consoleErrors.length} errors`);
    consoleErrors.slice(0, 10).forEach(e => console.log(`  ⚠ ${e.substring(0, 150)}`));
  } else {
    record('Console errors', true, 'Clean');
  }

  await browser.close();

  // ─── SUMMARY ──────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('COMMAND CENTER BROWSER QA — FINAL SUMMARY');
  console.log('═'.repeat(60));
  const passed = RESULTS.filter(r => r.pass).length;
  const failed = RESULTS.filter(r => !r.pass).length;
  console.log(`Total: ${RESULTS.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    RESULTS.filter(r => !r.pass).forEach(r => {
      console.log(`  • ${r.name}: ${r.detail}`);
    });
  }
  console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
  return { passed, failed, total: RESULTS.length };
}

runQA().catch(e => {
  console.error('QA FAILED:', e);
  process.exit(1);
});
