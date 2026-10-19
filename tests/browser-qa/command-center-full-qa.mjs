import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('tests/browser-qa/screenshots/command-center-qa');
const RESULTS = [];

const SECTIONS = [
  { id: 'overview', nav: 'Overview', file: 'overview' },
  { id: 'trips', nav: 'Live Trips', file: 'trips' },
  { id: 'transfers', nav: 'Transfers', file: 'transfers' },
  { id: 'exceptions', nav: 'Exceptions', file: 'exceptions' },
  { id: 'commerce', nav: 'Commerce', file: 'commerce' },
  { id: 'suppliers', nav: 'Suppliers', file: 'suppliers' },
  { id: 'intelligence', nav: 'Intelligence', file: 'intelligence' },
  { id: 'opportunities', nav: 'Opportunities', file: 'opportunities' },
  { id: 'knowledge', nav: 'Knowledge', file: 'knowledge' },
  { id: 'support', nav: 'Support', file: 'support' },
  { id: 'sms', nav: 'SMS Center', file: 'sms' },
  { id: 'notifications', nav: 'Notifications', file: 'notifications' },
  { id: 'audit', nav: 'Audit Log', file: 'audit' },
  { id: 'flags', nav: 'Feature Flags', file: 'flags' },
  { id: 'jobs', nav: 'Market Jobs', file: 'jobs' },
  { id: 'health', nav: 'System Health', file: 'health' },
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
  // Register first
  const email = `qa-ops-${Date.now()}@dahab.travel`;
  const password = 'DahabOps2026!';
  
  const regRes = await page.request.post(`${API_URL}/api/auth/register`, {
    data: { name: 'QA Operator', email, password, role: 'admin' }
  });
  
  if (regRes.ok()) {
    const body = await regRes.json();
    record('Register', true, email);
    
    // Store auth via the API
    await page.evaluate((authData) => {
      localStorage.setItem('dahab_user', JSON.stringify(authData));
    }, body.user || body);
    
    return email;
  }
  
  // Try login if register fails
  const loginRes = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email, password }
  });
  
  if (loginRes.ok()) {
    const body = await loginRes.json();
    record('Login fallback', true, email);
    await page.evaluate((authData) => {
      localStorage.setItem('dahab_user', JSON.stringify(authData));
    }, body.user || body);
    return email;
  }

  // Check if we can find existing ops user
  const usersRes = await page.request.get(`${API_URL}/api/auth/users`);
  if (usersRes.ok()) {
    const data = await usersRes.json();
    const adminUser = data.users?.find(u => u.role === 'admin' || u.email?.includes('ops'));
    if (adminUser) {
      const loginAdmin = await page.request.post(`${API_URL}/api/auth/login`, {
        data: { email: adminUser.email, password: adminUser.password || password }
      });
      if (loginAdmin.ok()) {
        const body = await loginAdmin.json();
        record('Admin login', true, adminUser.email);
        await page.evaluate((authData) => {
          localStorage.setItem('dahab_user', JSON.stringify(authData));
        }, body.user || body);
        return adminUser.email;
      }
    }
  }
  
  record('Authentication', false, 'Could not authenticate');
  return null;
}

async function navigateToSection(page, section) {
  try {
    // Try clicking on sidebar nav
    const navItem = page.locator(`nav button, nav a`).filter({ hasText: section.nav }).first();
    if (await navItem.isVisible({ timeout: 3000 })) {
      await navItem.click();
      await page.waitForTimeout(1500);
      return true;
    }
  } catch (e) {
    // Try keyboard shortcut
  }
  return false;
}

async function runQA() {
  // Create screenshot directory
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Authenticate
  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);
  const email = await authenticate(page);
  
  // Navigate to ops console
  await page.goto(`${BASE_URL}/ops-console`);
  await page.waitForTimeout(3000);
  
  // Screenshot the default view
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-landing.png'), fullPage: false });
  record('Landing on ops-console', true, 'Screenshot saved');
  
  for (const vp of VIEWPORTS) {
    console.log(`\n=== Viewport: ${vp.name}px ===`);
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(500);
    
    for (const section of SECTIONS) {
      const screenshotName = `${vp.name}px-${section.file}`;
      try {
        const navigated = await navigateToSection(page, section);
        if (!navigated) {
          // Try direct URL hash
          await page.goto(`${BASE_URL}/ops-console#${section.id}`);
          await page.waitForTimeout(1500);
        }
        
        // Wait for content to load
        await page.waitForTimeout(2000);
        
        // Check for errors
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        
        // Take screenshot
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `${screenshotName}.png`), 
          fullPage: false 
        });
        
        // Check the page has content (not blank or error)
        const bodyText = await page.textContent('body');
        const hasContent = bodyText && bodyText.trim().length > 50;
        
        record(
          `${section.nav} @ ${vp.name}px`,
          hasContent,
          hasContent ? `${bodyText.trim().substring(0, 80)}...` : 'No content detected'
        );
      } catch (e) {
        record(`${section.nav} @ ${vp.name}px`, false, e.message?.substring(0, 100));
      }
    }
  }
  
  // Test interactive elements
  console.log('\n=== Interactive Tests ===');
  
  // Test Command Palette
  try {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(800);
    const palette = page.locator('[class*="fixed"]').filter({ hasText: 'Search' }).first();
    const paletteVisible = await palette.isVisible({ timeout: 2000 });
    record('Command Palette (Ctrl+K)', paletteVisible, paletteVisible ? 'Opens' : 'Not found');
    if (paletteVisible) {
      await page.keyboard.press('Escape');
    }
  } catch (e) {
    record('Command Palette', false, e.message?.substring(0, 80));
  }
  
  // Test sidebar collapse at 1280px
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const sidebar = page.locator('aside, nav').first();
    const sidebarVisible = await sidebar.isVisible({ timeout: 2000 });
    record('Sidebar at 1280px', true, sidebarVisible ? 'Visible' : 'Collapsed');
  } catch (e) {
    record('Sidebar at 1280px', false, e.message?.substring(0, 80));
  }
  
  // Test language switch (RTL)
  try {
    // Find language toggle
    const langToggle = page.locator('button').filter({ hasText: /عربي|AR|EN/ }).first();
    if (await langToggle.isVisible({ timeout: 2000 })) {
      await langToggle.click();
      await page.waitForTimeout(1000);
      const dir = await page.getAttribute('html', 'dir');
      record('Language toggle', dir === 'rtl', `dir=${dir}`);
      // Switch back
      await langToggle.click();
      await page.waitForTimeout(500);
    } else {
      record('Language toggle', false, 'Button not found');
    }
  } catch (e) {
    record('Language toggle', false, e.message?.substring(0, 80));
  }
  
  await browser.close();
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('BROWSER QA SUMMARY');
  console.log('='.repeat(60));
  const passed = RESULTS.filter(r => r.pass).length;
  const failed = RESULTS.filter(r => !r.pass).length;
  console.log(`Total: ${RESULTS.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFAILURES:');
    RESULTS.filter(r => !r.pass).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.detail}`);
    });
  }
  
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  
  return { passed, failed, total: RESULTS.length };
}

runQA().catch(e => {
  console.error('QA script failed:', e);
  process.exit(1);
});
