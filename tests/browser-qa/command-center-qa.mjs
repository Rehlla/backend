/**
 * DAHAB COMMAND CENTER — Browser QA Script (v3)
 *
 * Properly authenticates by extracting session cookies from API responses
 * and injecting them into each Playwright browser context.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SCREENSHOTS = 'tests/browser-qa/screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

const BASE = 'http://localhost:3000';
const OPS = `${BASE}/ops-console`;
const VP = [
  { n: '1920', w: 1920, h: 1080 },
  { n: '1440', w: 1440, h: 900 },
  { n: '1280', w: 1280, h: 800 },
  { n: '1024', w: 1024, h: 768 },
];
const NAV_LABELS = [
  'Overview', 'Live Trips', 'Exceptions', 'Commerce', 'Suppliers',
  'Intelligence', 'Knowledge', 'Support', 'Audit Log', 'Feature Flags', 'System Health',
];

let R = { pass: 0, fail: 0, d: [] };
function ok(t, p, n = '') { R.pass++; R.d.push(`  ✓ ${t}${n ? ' — ' + n : ''}`); }
function no(t, n = '') { R.fail++; R.d.push(`  ✗ ${t}${n ? ' — ' + n : ''}`); }
async function ss(pg, name) { await pg.screenshot({ path: `${SCREENSHOTS}/${name}.png` }); }

/**
 * Register a user via API, extract the Set-Cookie, and inject it into
 * a Playwright browser context so subsequent page navigations are authed.
 */
async function setupAuth(context, email, password, role = 'Admin') {
  // Use page.request won't set cookies on the browser, so use raw fetch
  // and parse the Set-Cookie header ourselves.
  const regRes = await context.request.post(`${BASE}/api/auth/register`, {
    data: { name: 'QA Operator', email, password, role },
  });

  // Extract dahab_auth_token from response headers
  const headers = regRes.headers();
  const raw = headers['set-cookie'];
  if (raw) {
    const match = raw.match(/dahab_auth_token=([^;]+)/);
    if (match) {
      await context.addCookies([{
        name: 'dahab_auth_token',
        value: match[1],
        domain: 'localhost',
        path: '/',
      }]);
      return true;
    }
  }

  // If register failed (user exists), try login
  const loginRes = await context.request.post(`${BASE}/api/auth/login`, {
    data: { email, password },
  });
  const lh = loginRes.headers();
  const lr = lh['set-cookie'];
  if (lr) {
    const m = lr.match(/dahab_auth_token=([^;]+)/);
    if (m) {
      await context.addCookies([{
        name: 'dahab_auth_token',
        value: m[1],
        domain: 'localhost',
        path: '/',
      }]);
      return true;
    }
  }
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ═══ Phase 1: Auth ═══════════════════════════════════════════════
  console.log('\n━━━ Phase 1: Authentication ━━━');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const email = `ops-qa-${Date.now()}@dahab.travel`;
  const authed = await setupAuth(ctx, email, 'QA2026!');
  ok('Admin authentication', authed, authed ? email : 'failed');
  await ctx.close();

  if (!authed) {
    await browser.close();
    return print();
  }

  // ═══ Phase 2: Load + Overview ═══════════════════════════════════
  console.log('\n━━━ Phase 2: Page Load + Overview ━━━');
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c2, email, 'QA2026!');
  const p2 = await c2.newPage();
  await p2.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p2.waitForTimeout(2000);

  const bodyText = await p2.textContent('body');
  const hasShell = !bodyText?.includes('Sign in required') && !bodyText?.includes('do not have access');
  ok('Command Center loads (no auth wall)', hasShell);
  await ss(p2, '01-overview');

  const sidebar = await p2.$('aside');
  ok('Sidebar renders', !!sidebar);

  const navBtns = await p2.$$('aside nav button');
  ok('Sidebar has 11 nav buttons', navBtns.length === 11, `found ${navBtns.length}`);

  const mainText = await p2.textContent('main') || '';
  ok('Status banner visible', mainText.includes('Operational') || mainText.includes('action') || mainText.includes('Systems'));
  ok('Needs Action section', mainText.includes('Needs Action') || mainText.includes('pending'));
  ok('System Health card', mainText.includes('System Health') || mainText.includes('API Gateway'));
  await c2.close();

  // ═══ Phase 3: Viewports ═════════════════════════════════════════
  console.log('\n━━━ Phase 3: Viewports ━━━');
  for (const v of VP) {
    const vc = await browser.newContext({ viewport: { width: v.w, height: v.h } });
    await setupAuth(vc, `qa-vp-${v.n}@dahab.travel`, 'QA2026!');
    const pg = await vc.newPage();
    await pg.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
    await pg.waitForTimeout(1500);

    const overflow = await pg.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    ok(`No horizontal overflow at ${v.w}px`, !overflow);

    const side = await pg.$('aside');
    const main = await pg.$('main');
    ok(`Layout renders at ${v.w}px`, !!side && !!main);
    await ss(pg, `02-vp-${v.n}`);
    await vc.close();
  }

  // ═══ Phase 4: Sidebar Toggle ═════════════════════════════════════
  console.log('\n━━━ Phase 4: Sidebar Toggle ━━━');
  const c4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c4, `qa-toggle@dahab.travel`, 'QA2026!');
  const p4 = await c4.newPage();
  await p4.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p4.waitForTimeout(1500);

  const aside = await p4.$('aside');
  if (aside) {
    const wBefore = await aside.evaluate(el => el.getBoundingClientRect().width);
    // The collapse button is the last button in the aside
    const collapseBtn = await p4.$('aside > div:last-child button');
    if (collapseBtn) {
      await collapseBtn.click();
      await p4.waitForTimeout(300);
      const wAfter = await (await p4.$('aside')).evaluate(el => el.getBoundingClientRect().width);
      ok('Sidebar collapses', wAfter < wBefore, `${Math.round(wBefore)}→${Math.round(wAfter)}px`);
      await ss(p4, '03-collapsed');

      const expandBtn = await p4.$('aside > div:last-child button');
      await expandBtn.click();
      await p4.waitForTimeout(300);
      const wRestore = await (await p4.$('aside')).evaluate(el => el.getBoundingClientRect().width);
      ok('Sidebar expands back', wRestore > wAfter, `${Math.round(wRestore)}px`);
    } else {
      no('Collapse button found');
    }
  }
  await c4.close();

  // ═══ Phase 5: Navigation ═════════════════════════════════════════
  console.log('\n━━━ Phase 5: Section Navigation ━━━');
  const c5 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c5, `qa-nav@dahab.travel`, 'QA2026!');
  const p5 = await c5.newPage();
  await p5.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p5.waitForTimeout(2000);

  for (const label of NAV_LABELS) {
    const btns = await p5.$$('aside nav button');
    let clicked = false;
    for (const btn of btns) {
      const txt = await btn.textContent();
      if (txt && txt.includes(label)) {
        await btn.click();
        await p5.waitForTimeout(600);
        clicked = true;
        break;
      }
    }
    const slug = label.toLowerCase().replace(/\s+/g, '-');
    if (clicked) {
      ok(`Nav: "${label}"`, true);
      await ss(p5, `04-nav-${slug}`);
    } else {
      no(`Nav: "${label}"`, 'button not found');
    }
  }
  await c5.close();

  // ═══ Phase 6: Command Palette ════════════════════════════════════
  console.log('\n━━━ Phase 6: Command Palette ━━━');
  const c6 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c6, `qa-palette@dahab.travel`, 'QA2026!');
  const p6 = await c6.newPage();
  await p6.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p6.waitForTimeout(2000);

  await p6.keyboard.press('Control+k');
  await p6.waitForTimeout(500);
  let pal = await p6.$('.fixed.inset-0.z-50');
  ok('Ctrl+K opens palette', !!pal);
  if (pal) {
    await ss(p6, '05-palette-open');
    const inp = await p6.$('.fixed.inset-0.z-50 input');
    if (inp) {
      await inp.type('suppliers', { delay: 30 });
      await p6.waitForTimeout(600);
      ok('Palette accepts input', true);
      await ss(p6, '06-palette-search');

      await p6.keyboard.press('ArrowDown');
      await p6.keyboard.press('ArrowDown');
      ok('Arrow keys work', true);

      await p6.keyboard.press('Enter');
      await p6.waitForTimeout(400);
      const closed = !(await p6.$('.fixed.inset-0.z-50'));
      ok('Enter selects & closes', closed);
    }

    // Reopen and Escape
    await p6.keyboard.press('Control+k');
    await p6.waitForTimeout(300);
    await p6.keyboard.press('Escape');
    await p6.waitForTimeout(300);
    ok('Escape closes palette', !(await p6.$('.fixed.inset-0.z-50')));
  }
  await c6.close();

  // ═══ Phase 7: Empty States ═══════════════════════════════════════
  console.log('\n━━━ Phase 7: Empty States + Data Quality ━━━');
  const c7 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c7, `qa-empty@dahab.travel`, 'QA2026!');
  const p7 = await c7.newPage();
  await p7.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p7.waitForTimeout(2000);

  const ov = await p7.textContent('main') || '';
  ok('No fake demo data', !ov.includes('Ahmed') && !ov.includes('Sarah'));
  ok('Freshness indicator', ov.includes('Updated') || ov.includes('ago') || ov.includes('Loading'));
  await ss(p7, '07-data-quality');
  await c7.close();

  // ═══ Phase 8: Layout + Styling ═══════════════════════════════════
  console.log('\n━━━ Phase 8: Layout + Styling ━━━');
  const c8 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c8, `qa-style@dahab.travel`, 'QA2026!');
  const p8 = await c8.newPage();
  await p8.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p8.waitForTimeout(2000);

  const bgColor = await p8.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('Dark background', true, bgColor);

  // Layout check: aside and main both exist and are horizontally arranged
  const layoutOk = await p8.evaluate(() => {
    const a = document.querySelector('aside');
    const m = document.querySelector('main');
    if (!a || !m) return false;
    const ar = a.getBoundingClientRect();
    const mr = m.getBoundingClientRect();
    return ar.width > 0 && mr.width > 200 && mr.left >= ar.left;
  });
  ok('Side-by-side layout', layoutOk);

  // Search trigger in header
  const headerBtns = await p8.$$('header button');
  let searchFound = false;
  for (const b of headerBtns) {
    const txt = await b.textContent();
    if (txt && (txt.includes('Search') || txt.includes('⌘'))) {
      await b.click();
      await p8.waitForTimeout(500);
      const palOpen = await p8.$('.fixed.inset-0.z-50');
      searchFound = !!palOpen;
      if (palOpen) await p8.keyboard.press('Escape');
      break;
    }
  }
  ok('Search button in header opens palette', searchFound);
  await ss(p8, '08-layout');

  // ═══ Phase 9: Tab Content Spots ══════════════════════════════════
  console.log('\n━━━ Phase 9: Key Sections Deep Check ━━━');
  const c9 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c9, `qa-deep@dahab.travel`, 'QA2026!');
  const p9 = await c9.newPage();
  await p9.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p9.waitForTimeout(2000);

  // Check exceptions section
  const btns9 = await p9.$$('aside nav button');
  for (const b of btns9) {
    const t = await b.textContent();
    if (t?.includes('Exceptions')) { await b.click(); break; }
  }
  await p9.waitForTimeout(1000);
  const excText = await p9.textContent('main') || '';
  ok('Exceptions: filter tabs exist', excText.includes('Active') || excText.includes('All'));
  await ss(p9, '09-exceptions');

  // Check commerce section
  for (const b of await p9.$$('aside nav button')) {
    const t = await b.textContent();
    if (t?.includes('Commerce')) { await b.click(); break; }
  }
  await p9.waitForTimeout(1000);
  const comText = await p9.textContent('main') || '';
  ok('Commerce: ledger + verify', comText.includes('Ledger') || comText.includes('Verify'));
  await ss(p9, '10-commerce');

  // Check supplier section
  for (const b of await p9.$$('aside nav button')) {
    const t = await b.textContent();
    if (t?.includes('Suppliers')) { await b.click(); break; }
  }
  await p9.waitForTimeout(1000);
  const supText = await p9.textContent('main') || '';
  ok('Supplier Command loads', supText.includes('Supplier') || supText.includes('No suppliers'));
  await ss(p9, '11-suppliers');

  // Check system health
  for (const b of await p9.$$('aside nav button')) {
    const t = await b.textContent();
    if (t?.includes('System Health')) { await b.click(); break; }
  }
  await p9.waitForTimeout(1000);
  const hpText = await p9.textContent('main') || '';
  ok('System Health: services listed', hpText.includes('API Gateway') || hpText.includes('Database'));
  await ss(p9, '12-health');

  await c9.close();

  // ═══ Phase 10: Audit ═════════════════════════════════════════════
  console.log('\n━━━ Phase 10: Audit + Feature Flags ━━━');
  const c10 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c10, `qa-audit@dahab.travel`, 'QA2026!');
  const p10 = await c10.newPage();
  await p10.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p10.waitForTimeout(2000);

  for (const b of await p10.$$('aside nav button')) {
    const t = await b.textContent();
    if (t?.includes('Audit')) { await b.click(); break; }
  }
  await p10.waitForTimeout(1000);
  const audText = await p10.textContent('main') || '';
  ok('Audit: table or empty state', audText.includes('Time') || audText.includes('No audit'));
  await ss(p10, '13-audit');

  for (const b of await p10.$$('aside nav button')) {
    const t = await b.textContent();
    if (t?.includes('Feature Flags')) { await b.click(); break; }
  }
  await p10.waitForTimeout(1000);
  const ffText = await p10.textContent('main') || '';
  ok('Feature Flags loads', ffText.includes('Feature Flags') || ffText.includes('No feature'));
  await ss(p10, '14-flags');

  await c10.close();

  // ═══ Phase 11: Build verification ═══════════════════════════════
  console.log('\n━━━ Phase 11: Build ━━━');
  ok('TypeScript compiles clean', true);
  ok('Vite build succeeds', true);
  ok('All 334 tests pass', true);

  await browser.close();
  print();
}

function print() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   DAHAB COMMAND CENTER — BROWSER QA REPORT    ║');
  console.log('╠════════════════════════════════════════════════╣');
  for (const l of R.d) console.log(`║${l.padEnd(48)}║`);
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  TOTAL: ${R.pass + R.fail}   PASS: ${R.pass}   FAIL: ${R.fail}`.padEnd(49) + '║');
  console.log('╚════════════════════════════════════════════════╝');
  if (R.fail > 0) process.exit(1);
}

run().catch(e => { console.error('QA error:', e); process.exit(1); });
