import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3000';
const DIR = path.resolve('tests/browser-qa/screenshots/command-center-qa-v4');
const R = [];

const SECTIONS = [
  { nav: 'Overview', file: 'overview', probe: 'Operational|Status|Needs Action|System Status|Loading|Health' },
  { nav: 'Live Trips', file: 'trips', probe: 'Trip|trip|Traveler|Stage|Pending|Loading' },
  { nav: 'Transfers', file: 'transfers', probe: 'Transfer|transfer|Driver|Vehicle|Route|Loading' },
  { nav: 'Exceptions', file: 'exceptions', probe: 'Exception|exception|severity|payment|booking|Loading' },
  { nav: 'Commerce', file: 'commerce', probe: 'Ledger|ledger|Payment|payment|Debit|Credit|Verify|Loading' },
  { nav: 'Suppliers', file: 'suppliers', probe: 'Supplier|supplier|Verification|Reliability|Confirm|Loading' },
  { nav: 'Intelligence', file: 'intelligence', probe: 'Intelligence|intelligence|Source|Alert|Competitor|Market|Loading' },
  { nav: 'Opportunities', file: 'opportunities', probe: 'Opportunity|opportunity|Accept|Reject|Evidence|Confidence|Loading' },
  { nav: 'Knowledge', file: 'knowledge', probe: 'Knowledge|knowledge|Gap|Conflict|Entity|Stale|Health|Loading' },
  { nav: 'Support', file: 'support', probe: 'Support|support|Message|conversation|SLA|Traveler|Loading' },
  { nav: 'SMS Center', file: 'sms', probe: 'SMS|sms|Dispatch|Recipient|Message|Twilio|Loading' },
  { nav: 'Notifications', file: 'notifications', probe: 'Notification|notification|Unread|Urgent|Read|Loading' },
  { nav: 'Audit Log', file: 'audit', probe: 'Audit|audit|Action|Actor|Entity|export|CSV|Loading' },
  { nav: 'Feature Flags', file: 'flags', probe: 'Feature|feature|Flag|flag|Toggle|Experiment|Loading' },
  { nav: 'Market Jobs', file: 'jobs', probe: 'Job|job|Run|Enqueue|Status|Schedule|Market|Loading' },
  { nav: 'System Health', file: 'health', probe: 'Health|health|API|Database|Service|Integration|Healthy|Loading' },
];

const VPS = [
  { name: '1920', w: 1920, h: 1080 },
  { name: '1440', w: 1440, h: 900 },
  { name: '1280', w: 1280, h: 800 },
  { name: '1024', w: 1024, h: 768 },
];

function ok(name, pass, detail) {
  const icon = pass ? '✅' : '❌';
  const msg = `${icon} ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(msg);
  R.push({ name, pass, detail });
}

async function auth(ctx) {
  const email = `qa-${Date.now()}@dahab.travel`;
  // Register with Admin role
  const res = await ctx.request.post(`${API}/api/auth/register`, {
    data: { name: 'QA Operator', email, password: 'DahabOps2026!', role: 'Admin' }
  });
  if (!res.ok()) { ok('Register', false, `status=${res.status()}`); return false; }

  // Extract cookie from Set-Cookie header
  const raw = res.headers()['set-cookie'] || '';
  const m = raw.match(/dahab_auth_token=([^;]+)/);
  if (m) {
    await ctx.addCookies([{ name: 'dahab_auth_token', value: m[1], domain: 'localhost', path: '/' }]);
    ok('Auth cookie', true, email);
    return true;
  }
  ok('Auth cookie', false, 'No Set-Cookie in register response');
  return false;
}

async function nav(page, sec) {
  try {
    const btn = page.locator('nav button').filter({ hasText: sec.nav }).first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(2000);
    return true;
  } catch {
    // Sidebar might be collapsed — expand it
    try {
      const toggle = page.locator('aside button').last();
      await toggle.click({ timeout: 1000 });
      await page.waitForTimeout(500);
      const btn = page.locator('nav button').filter({ hasText: sec.nav }).first();
      await btn.waitFor({ state: 'visible', timeout: 3000 });
      await btn.click();
      await page.waitForTimeout(2000);
      return true;
    } catch {
      return false;
    }
  }
}

async function mainText(page) {
  try {
    const m = page.locator('main');
    if (await m.isVisible({ timeout: 1000 })) return await m.textContent() || '';
  } catch {}
  return '';
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Console errors collector
  const errs = [];
  page.on('console', msg => { if (msg.type() === 'error') errs.push(msg.text()); });
  page.on('pageerror', err => errs.push(err.message));

  // ─── Auth ────────────────────────────────────────────────────
  console.log('══════ AUTH ══════');
  const ok_auth = await auth(ctx);
  if (!ok_auth) { await browser.close(); return; }

  // ─── Load ops console ────────────────────────────────────────
  console.log('\n══════ LOAD ══════');
  await page.goto(`${BASE}/ops-console`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(DIR, '00-landing.png'), fullPage: false });

  const navCount = await page.locator('nav button').count();
  ok('Command Center loaded', navCount > 0, `${navCount} nav buttons`);

  if (navCount === 0) {
    // Diagnose
    const body = await page.textContent('body') || '';
    console.log(`URL: ${page.url()}`);
    console.log(`Body: ${body.substring(0, 300)}`);
    await browser.close();
    return;
  }

  // ─── 1920px: All sections ─────────────────────────────────────
  console.log('\n══════ SECTIONS @ 1920px ══════');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);

  for (const sec of SECTIONS) {
    const n = await nav(page, sec);
    if (!n) { ok(`${sec.nav} nav`, false, 'click failed'); continue; }

    const txt = await mainText(page);
    const has = new RegExp(sec.probe, 'i').test(txt);
    await page.screenshot({ path: path.join(DIR, `1920-${sec.file}.png`), fullPage: false });
    ok(`${sec.nav} renders`, has, has ? 'OK' : `probe miss (${txt.substring(0, 40)}...)`);
  }

  // ─── Responsive ───────────────────────────────────────────────
  for (const vp of VPS) {
    if (vp.name === '1920') continue;
    console.log(`\n══════ ${vp.name}px ══════`);
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(500);
    for (const sec of SECTIONS) {
      await nav(page, sec);
      const txt = await mainText(page);
      const has = new RegExp(sec.probe, 'i').test(txt);
      await page.screenshot({ path: path.join(DIR, `${vp.name}-${sec.file}.png`), fullPage: false });
      ok(`${sec.nav} @ ${vp.name}px`, has, has ? 'OK' : 'Missing');
    }
  }

  // ─── Interactive ──────────────────────────────────────────────
  console.log('\n══════ INTERACTIVE ══════');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);

  // Command Palette — click the search trigger in the header
  try {
    const searchBtn = page.locator('header button').first();
    if (await searchBtn.isVisible({ timeout: 2000 })) {
      await searchBtn.click();
      await page.waitForTimeout(1000);
      const paletteInput = page.locator('.fixed input[type="text"], .fixed input').first();
      const vis = await paletteInput.isVisible({ timeout: 2000 });
      ok('Command Palette (click)', vis, vis ? 'Opens' : 'Input not found');
      if (vis) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    } else {
      ok('Command Palette (click)', false, 'No header button');
    }
  } catch (e) { ok('Command Palette (click)', false, e.message?.substring(0, 80)); }

  // Ctrl+K
  try {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1000);
    const pi = page.locator('.fixed input').first();
    const vis2 = await pi.isVisible({ timeout: 2000 });
    ok('Command Palette (Ctrl+K)', vis2, vis2 ? 'Opens' : 'Not detected');
    if (vis2) await page.keyboard.press('Escape');
  } catch (e) { ok('Command Palette (Ctrl+K)', false, e.message?.substring(0, 80)); }

  // Sidebar collapse at 1280px
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(1000);
    const sidebar = page.locator('aside');
    const w = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    ok('Sidebar auto-collapse @ 1280px', w < 80, `${w}px`);
  } catch (e) { ok('Sidebar collapse', false, e.message?.substring(0, 80)); }

  // Language toggle
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    const btns = await page.locator('button').all();
    for (const btn of btns) {
      const txt = await btn.textContent().catch(() => '');
      if (txt && (txt.includes('عربي') || txt.match(/\bAR\b/) || txt.match(/\bEN\b/))) {
        await btn.click();
        await page.waitForTimeout(1500);
        const dir = await page.locator('div[dir]').first().getAttribute('dir');
        await page.screenshot({ path: path.join(DIR, 'rtl-overview.png'), fullPage: false });
        ok('Language toggle → RTL', dir === 'rtl', `dir=${dir}`);
        await btn.click();
        await page.waitForTimeout(500);
        break;
      }
    }
  } catch (e) { ok('Language toggle', false, e.message?.substring(0, 80)); }

  // ─── Console errors ──────────────────────────────────────────
  console.log('\n══════ ERRORS ══════');
  if (errs.length) {
    ok('Console errors', false, `${errs.length} errors`);
    errs.slice(0, 10).forEach(e => console.log(`  ⚠ ${e.substring(0, 150)}`));
  } else {
    ok('Console errors', true, 'Clean');
  }

  await browser.close();

  // ─── Summary ─────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  const p = R.filter(r => r.pass).length;
  const f = R.filter(r => !r.pass).length;
  console.log(`Total: ${R.length} | ✅ ${p} | ❌ ${f}`);
  if (f) {
    console.log('\n❌ FAILURES:');
    R.filter(r => !r.pass).forEach(r => console.log(`  • ${r.name}: ${r.detail}`));
  }
  console.log(`Screenshots: ${DIR}`);
}

run().catch(e => { console.error('QA FAILED:', e); process.exit(1); });
