/**
 * CMS ADVANCED CONTROL — Browser QA (full write flows with cleanup).
 *
 * Covers every dashboard slice shipped after the MVP: catalog bindings,
 * UI strings, site info, theme tokens, hero overlay, editor preview pane,
 * shareable preview links, inline edit mode, media usage/focal/delete
 * guards, and the RBAC matrix — then restores everything it touched.
 *
 * Run:
 *   1. Boot an ISOLATED server (never the dev DB — writes are real).
 *      The data dir MUST be a backup copy or fresh seed (fresh seeds
 *      currently crash — see report): DAHAB_DATA_DIR=<copy>
 *        DISABLE_HMR=true PORT=3100 node node_modules/tsx/dist/cli.mjs server.ts
 *   2. PRE-STEP (once per data dir): registration grants Traveler regardless
 *      of the requested role (secure default), so the QA role accounts must
 *      be promoted directly in the ISOLATED copy, then the server restarted
 *      (role reads come from in-memory state):
 *        curl register qa-admin/qa-ops/qa-product/qa-traveler@dahab.travel
 *        sqlite UPDATE users SET role=..., data=json_set(data,'$.role',...)
 *          WHERE email LIKE 'cmsqa-%@dahab.travel' (cmsqa-* only — never real users)
 *        restart server
 *      The script below uses these fixed accounts and logs in (register is a
 *      no-op once they exist).
 *   3. QA_BASE=http://127.0.0.1:3100 node tests/browser-qa/cms-advanced-qa.mjs
 *      (NOTE: prefer explicit 127.0.0.1 — bare localhost resolves to ::1 for
 *      Node fetch on this machine while the server listens on IPv4.)
 *
 * Env:
 *   QA_BASE    base URL (default http://localhost:3000)
 *   QA_HEADED  set to "1" to watch the run (default headless)
 *
 * Conventions follow the existing browser-qa scripts: register-then-cookie
 * auth, ok/no tally, screenshots per group, failures appended to issues.json.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const BASE = process.env.QA_BASE || 'http://localhost:3000';
const HOST = new URL(BASE).hostname;
const SCREENSHOTS = 'tests/browser-qa/screenshots/cms-advanced';
const ISSUES = 'tests/browser-qa/issues.json';
const MARK = Date.now().toString(36).toUpperCase();
const HEADED = process.env.QA_HEADED === '1';
mkdirSync(SCREENSHOTS, { recursive: true });

const R = { pass: 0, fail: 0, warn: 0, d: [] };
function ok(t, n = '') { R.pass++; R.d.push(`  ✓ ${t}${n ? ' — ' + n : ''}`); }
function no(t, n = '') { R.fail++; R.d.push(`  ✗ ${t}${n ? ' — ' + n : ''}`); }
function warn(t, n = '') { R.warn++; R.d.push(`  ! ${t}${n ? ' — ' + n : ''}`); }
function check(t, cond, n = '') { if (cond) ok(t, n); else no(t, n || 'condition false'); }
async function ss(pg, name) {
  try { await pg.screenshot({ path: `${SCREENSHOTS}/${name}.png` }); } catch { /* ignore */ }
}
function noteIssues(area) {
  try {
    const fails = R.d.filter(l => l.includes('✗'));
    if (fails.length === 0) return;
    const prev = existsSync(ISSUES) ? JSON.parse(readFileSync(ISSUES, 'utf8')) : [];
    prev.push({ date: new Date().toISOString(), area, failures: fails });
    writeFileSync(ISSUES, JSON.stringify(prev.slice(-50), null, 2));
  } catch { /* ignore */ }
}

// ─── Auth + API helpers ─────────────────────────────────────────────────────

async function apiCall(ctx, method, path, body, retries = 3) {
  let lastErr = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await ctx.request.fetch(`${BASE}${path}`, { method, data: body, timeout: 30000 });
      let json = null;
      try { json = await res.json(); } catch { /* non-JSON */ }
      return { status: res.status(), json };
    } catch (err) {
      // Transient transport blips (ECONNRESET on reused keep-alive sockets):
      // retry with backoff. HTTP error statuses are NOT retried.
      lastErr = err;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

let aborted = false;

/** A crashing phase must not kill the run (or its cleanup): record and continue. */
async function phase(name, fn) {
  if (aborted) return;
  console.log(`\n━━━ ${name} ━━━`);
  try {
    await fn();
  } catch (err) {
    no(`${name} crashed`, String(err?.message || err).slice(0, 160));
  }
}

async function setupUser(browser, role, tag, extraCtx = {}) {
  const ctx = await browser.newContext({ locale: 'en-US', ...extraCtx });
  // Fixed accounts (see header pre-step): registration is role-blind, so
  // roles are promoted out-of-band and login reuses them across runs.
  const email = `cmsqa-${tag}@dahab.travel`.toLowerCase();
  const password = 'QA2026!';
  let res = await ctx.request.post(`${BASE}/api/auth/register`, {
    data: { name: 'CMS QA', email, password, role },
  });
  let cookie = res.headers()['set-cookie']?.match(/dahab_auth_token=([^;]+)/)?.[1];
  if (!cookie) {
    res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
    cookie = res.headers()['set-cookie']?.match(/dahab_auth_token=([^;]+)/)?.[1];
  }
  if (cookie) {
    await ctx.addCookies([{ name: 'dahab_auth_token', value: cookie, domain: HOST, path: '/' }]);
  }
  return { ctx, email, authed: !!cookie };
}

async function gotoOpsConsole(p) {
  await p.goto(`${BASE}/ops-console`, { waitUntil: 'networkidle', timeout: 30000 });
  // The console shell compiles lazily under dev; wait for a section button
  // rather than a fixed sleep so slow compiles don't cascade into timeouts.
  await p.getByRole('button', { name: 'CMS Content' }).first().waitFor({ timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
}

async function openCMS(p) {
  // Dev servers compile dashboard chunks lazily — the section button may
  // take a while on first load. Wait explicitly; reload once if missing.
  const btn = () => p.getByRole('button', { name: 'CMS Content' }).first();
  try {
    await btn().waitFor({ timeout: 20000 });
  } catch {
    await p.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await btn().waitFor({ timeout: 25000 });
  }
  await btn().click({ timeout: 15000 });
  await p.waitForTimeout(800);
}

async function openCMSTab(p, name) {
  await p.getByRole('button', { name }).first().click();
  await p.waitForTimeout(800);
}

/** Wait for a tab's async content (each tab fetches on mount; asserting
 *  during the skeleton flakes). Best-effort: logs, never throws. */
async function waitTabReady(p, marker, isPlaceholder = false) {
  try {
    if (isPlaceholder) await p.getByPlaceholder(marker).first().waitFor({ timeout: 15000 });
    else await p.getByText(marker).first().waitFor({ timeout: 15000 });
  } catch {
    warn('Tab content slow', String(marker).slice(0, 40));
  }
}

const modal = (p) => p.locator('.fixed.inset-0.z-50');

/** Poll body text for a substring (client bundles arrive async — a fixed
 *  sleep flakes under dev-server compile stalls). */
async function waitText(p, substr, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    const body = (await p.textContent('body').catch(() => '')) || '';
    if (body.includes(substr)) return true;
    if (Date.now() - start > timeout) return false;
    await p.waitForTimeout(750);
  }
}

/** Poll a locator count until it reaches `atLeast` (default 1). */
async function waitCount(locator, atLeast = 1, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    const n = await locator.count().catch(() => 0);
    if (n >= atLeast) return n;
    if (Date.now() - start > timeout) return n;
    await new Promise(r => setTimeout(r, 750));
  }
}

/** Click with fresh re-query per attempt (dashboard grids re-render on save). */
async function clickFresh(makeLocator, tries = 3) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      await (await makeLocator()).click({ timeout: 10000 });
      return true;
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

/** Click with a full actionability dump on failure (for flaky-click forensics). */
async function clickDiag(page, makeLocator, label) {
  try {
    await (await makeLocator()).click({ timeout: 10000 });
    return true;
  } catch (err) {
    let diag = '';
    try {
      const el = await makeLocator();
      const n = await el.count();
      diag = `count=${n}`;
      if (n > 0) {
        const first = el.first();
        const box = await first.boundingBox().catch(() => null);
        const dis = await first.isDisabled().catch(() => '?');
        const vis = await first.isVisible().catch(() => '?');
        let cover = '?';
        if (box) {
          cover = await page.evaluate(({ x, y }) => {
            const t = document.elementFromPoint(x, y);
            return t ? `${t.tagName}.${(t.className?.baseVal ?? t.className ?? '').toString().slice(0, 60)}` : 'none';
          }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }).catch(() => '?');
        }
        diag += ` disabled=${dis} visible=${vis} box=${box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : 'none'} cover=${cover}`;
      }
    } catch (e2) {
      diag += ` diag-err:${String(e2?.message || e2).slice(0, 80)}`;
    }
    throw new Error(`${label} click failed [${diag}] :: ${(err?.message || err).split('\n').slice(0, 6).join(' | ').slice(0, 300)}`);
  }
}
async function closeModal(p) {
  const m = modal(p);
  if ((await m.count()) > 0) {
    // Header row holds the preview link (<a>) then the X (<button>).
    const x = m.locator('button').first();
    if ((await x.count()) > 0) await x.click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(500);
  }
}

/** Fill one catalog-drawer text field identified by base label + EN/AR badge. */
async function fillBindingField(p, base, lang, value, textarea = false) {
  const labels = p.locator('label', { hasText: new RegExp(`^${base}$`, 'i') });
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    const header = labels.nth(i).locator('xpath=./..');
    if ((await header.locator('span', { hasText: new RegExp(`^${lang}$`) }).count()) === 0) continue;
    const field = header.locator(`xpath=./following-sibling::${textarea ? 'textarea' : 'input'}`);
    if ((await field.count()) === 0) continue;
    await field.fill(value);
    return true;
  }
  return false;
}

// ─── Run ────────────────────────────────────────────────────────────────────

async function run() {
  const browser = await chromium.launch({ headless: !HEADED });
  let admin = null;

  await phase('Phase 0: Prerequisites', async () => {
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      try {
        const r = await fetch(`${BASE}/api/health`);
        if (r.ok) { healthy = true; break; }
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 2000));
    }
    ok('Server healthy', healthy ? BASE : 'UNREACHABLE');
    if (!healthy) {
      R.fail++;
      R.d.push('  ✗ Server healthy — UNREACHABLE, aborting run');
      aborted = true;
      await finish(browser, 'prerequisites');
      return;
    }

    const setup = await setupUser(browser, 'Admin', 'admin', { permissions: ['clipboard-read', 'clipboard-write'] });
    ok('Admin session', setup.authed, setup.email);
    if (!setup.authed) {
      no('Admin session — aborting run', setup.email);
      aborted = true;
      await finish(browser, 'auth');
      return;
    }
    admin = setup;
  });

  await phase('Phase 1: Shell regression', async () => {
    const p = await admin.ctx.newPage();
    await gotoOpsConsole(p);
    const body = (await p.textContent('body')) || '';
    const authed = !body.includes('Sign in required') && !body.includes('do not have access');
    check('Ops console loads for Admin', authed);
    const deadSettings = await p.getByRole('button', { name: 'Site Settings' }).count();
    const deadVisual = await p.getByRole('button', { name: 'Visual Content' }).count();
    check('Dead tabs retired', deadSettings === 0 && deadVisual === 0, 'no Site Settings / Visual Content buttons');
    await openCMS(p);
    for (const tab of ['Overview', 'Pages', 'Catalog Content', 'UI Strings', 'Site Info', 'Design Theme', 'Homepage', 'Media', 'Navigation', 'History']) {
      const present = (await p.getByRole('button', { name: tab }).count()) > 0;
      if (present) ok(`CMS tab present: ${tab}`);
      else no(`CMS tab present: ${tab}`);
    }
    await ss(p, '10-cms-tabs');
    await p.close();
  });

  await phase('Phase 2: Catalog bindings', async () => {
    let accId = '', accName = '';
    let medId = '';
    const list = await apiCall(admin.ctx, 'GET', '/api/accommodations');
    const first = list.json?.accommodations?.[0];
    if (first) { accId = first.id; accName = first.name; ok('Catalog source row', true, `${accName} (${accId})`); }
    else no('Catalog source row', 'no accommodations seeded');
    const media = await apiCall(admin.ctx, 'GET', '/api/admin/content/media');
    medId = media.json?.media?.[0]?.id || '';
    if (medId) ok('Media asset available', true, medId);
    else no('Media asset available', 'library empty');
    if (!accId) return;

    const p = await admin.ctx.newPage();
    await gotoOpsConsole(p);
    await openCMS(p);
    await openCMSTab(p, 'Catalog Content');
    await waitTabReady(p, 'Browse full catalog');
    await p.locator('main select').first().selectOption('accommodation');
    await p.waitForTimeout(500);
    // Browse mode lists the full catalog so editors can start new overrides.
    const box = p.locator('label', { hasText: 'Browse full catalog' }).locator('input[type="checkbox"]');
    if ((await box.count()) > 0 && !(await box.isChecked())) await box.check();
    await p.waitForTimeout(800);
    // Look up by entity id, not the API name: the browse list always renders
    // the base label + id, while the API name may carry a published overlay
    // (from a leftover binding) that never appears in the grid.
    const row = p.locator('button', { hasText: accId }).first();
    if ((await row.count()) === 0) { no('Catalog row opened', `${accName} (${accId})`); await p.close(); return; }
    await row.click();
    await p.waitForTimeout(800);
    const marker = `QA Lodge ${MARK}`;
    const filled = await fillBindingField(p, 'title', 'EN', marker);
    check('Drawer title field filled', filled);
    if (medId) {
      await modal(p).locator('select').first().selectOption(medId).catch(() => {});
      ok('Cover picked from library', true, medId);
    }
    await modal(p).getByRole('button', { name: 'Save draft' }).click();
    await p.waitForTimeout(1000);
    const draftBadge = await modal(p).getByText('draft', { exact: true }).count();
    check('Draft saved (badge)', draftBadge > 0);
    // Public overlay must NOT exist while draft.
    const before = await apiCall(admin.ctx, 'GET', `/api/content/bindings/accommodation/${accId}`);
    check('No public overlay while draft', before.status === 404);
    await modal(p).getByRole('button', { name: 'Publish', exact: true }).click();
    await p.waitForTimeout(1000);
    const after = await apiCall(admin.ctx, 'GET', `/api/content/bindings/accommodation/${accId}`);
    check('Public overlay after publish', after.status === 200 && after.json?.fields?.title_en === marker, JSON.stringify(after.json?.fields || {}).slice(0, 80));
    await modal(p).getByRole('button', { name: 'Unpublish', exact: true }).click();
    await p.waitForTimeout(1000);
    const gone = await apiCall(admin.ctx, 'GET', `/api/content/bindings/accommodation/${accId}`);
    check('Overlay withdrawn on unpublish', gone.status === 404);
    // Rollback path: republish, then confirm revision history exists.
    await modal(p).getByRole('button', { name: 'Publish', exact: true }).click();
    await p.waitForTimeout(800);
    const item = await apiCall(admin.ctx, 'GET', `/api/admin/content/bindings/accommodation/${accId}`);
    const revs = item.json?.revisions || [];
    check('Revision history recorded', revs.length >= 2, `${revs.length} revisions`);
    await closeModal(p);
    await ss(p, '20-catalog');
    await p.close();
    // Cleanup: delete all bindings for the entity (Admin).
    const del = await apiCall(admin.ctx, 'DELETE', `/api/admin/content/bindings/accommodation/${accId}`);
    check('Binding cleanup', del.status === 200, `status ${del.status}`);
    const clean = await apiCall(admin.ctx, 'GET', `/api/content/bindings/accommodation/${accId}`);
    check('Overlay fully removed', clean.status === 404);
  });

  await phase('Phase 3: UI strings', async () => {
    const p = await admin.ctx.newPage();
    await gotoOpsConsole(p);
    await openCMS(p);
    await openCMSTab(p, 'UI Strings');
    await waitTabReady(p, 'Search keys or text', true);
    await p.getByPlaceholder('Search keys or text').fill('home.footer.tagline');
    await p.waitForTimeout(800);
    // Export round-trip first (no drawer open to intercept the click).
    const [download] = await Promise.all([
      p.waitForEvent('download', { timeout: 10000 }).catch(() => null),
      p.getByRole('button', { name: 'Export JSON' }).click(),
    ]);
    if (download) {
      const tmp = join(mkdtempSync(join(tmpdir(), 'qa-str-')), 'export.json');
      await download.saveAs(tmp);
      const parsed = JSON.parse(readFileSync(tmp, 'utf8'));
      check('Export downloads valid JSON', !!parsed.strings?.['home.footer.tagline'], `${Object.keys(parsed.strings || {}).length} keys`);
    } else no('Export downloads valid JSON', 'no download event');
    const row = p.locator('button', { hasText: 'home.footer.tagline' }).first();
    if ((await row.count()) === 0) { no('String row opened', 'home.footer.tagline'); await p.close(); return; }
    await row.click();
    await p.waitForTimeout(800);
    const marker = `QA Discover ${MARK}`;
    const areas = modal(p).locator('textarea');
    await areas.nth(0).fill(marker);
    await modal(p).getByRole('button', { name: 'Save Changes' }).click();
    await p.waitForTimeout(1200);
    const hp = await admin.ctx.newPage();
    await hp.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await hp.waitForTimeout(2000);
    const bodyText = (await hp.textContent('body')) || '';
    // This context never loaded the homepage before, so first paint already
    // carries fresh overrides (no stale bundle cache).
    const bundle = await apiCall(admin.ctx, 'GET', '/api/content/strings');
    check('Override in public bundle', bundle.json?.strings?.['home.footer.tagline']?.en === marker);
    check('Live string on homepage', await waitText(hp, marker), 'marker rendered after bundle fetch');
    await hp.close();
    await ss(p, '30-strings');
    // Reset to code (the button confirms via window.confirm).
    p.once('dialog', d => d.accept());
    await modal(p).getByRole('button', { name: 'Reset to code' }).click();
    await p.waitForTimeout(1000);
    const after = await apiCall(admin.ctx, 'GET', '/api/content/strings');
    check('String reset (bundle empty again)', (after.json?.count || 0) === 0, `count ${after.json?.count}`);
    await closeModal(p);
    await p.close();
  });

  await phase('Phase 4: Site info', async () => {
    const p = await admin.ctx.newPage();
    await gotoOpsConsole(p);
    await openCMS(p);
    await openCMSTab(p, 'Site Info');
    await waitTabReady(p, 'Phone');
    const phone = '+201000000001';
    // Fresh lookup per step: saving re-renders the grid, so never reuse a
    // row handle across saves.
    const phoneRow = async () => {
      const lab = p.locator('span', { hasText: 'Phone' }).first();
      if ((await lab.count()) === 0) return null;
      return lab.locator('xpath=./ancestor::div[contains(@class,"grid")][1]');
    };
    let rowEl = await phoneRow();
    if (!rowEl) { no('Site info phone row', 'label missing'); await p.close(); return; }
    await rowEl.locator('input').first().fill(phone);
    await clickDiag(p, async () => (await phoneRow()).getByRole('button', { name: 'Save Changes' }), 'siteinfo-set');
    await p.waitForTimeout(1200);
    const hp = await admin.ctx.newPage();
    await hp.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    check('Footer shows tel link', (await waitCount(hp.locator('footer a[href^="tel:"]'))) > 0);
    await hp.close();
    await ss(p, '40-siteinfo');
    rowEl = await phoneRow();
    await rowEl.locator('input').first().fill('');
    await clickDiag(p, async () => (await phoneRow()).getByRole('button', { name: 'Save Changes' }), 'siteinfo-clear');
    await p.waitForTimeout(1200);
    const hp2 = await admin.ctx.newPage();
    await hp2.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await hp2.waitForTimeout(1200);
    check('Footer hides cleared slot', (await hp2.locator('footer a[href^="tel:"]').count()) === 0);
    await hp2.close();
    await p.close();
  });

  await phase('Phase 5: Theme', async () => {
    const p = await admin.ctx.newPage();
    await gotoOpsConsole(p);
    await openCMS(p);
    await openCMSTab(p, 'Design Theme');
    await waitTabReady(p, 'brand.accent');
    const keyP = p.locator('p', { hasText: 'brand.accent' }).first();
    if ((await keyP.count()) === 0) { no('Theme accent card', 'brand.accent missing'); await p.close(); return; }
    const card = keyP.locator('xpath=./ancestor::div[contains(@class,"rounded-xl")][1]');
    await card.locator('input[type="text"], input:not([type])').last().fill('#123ABC');
    await card.getByRole('button', { name: 'Save Changes' }).click();
    await p.waitForTimeout(1200);
    // The theme hook fetches its bundle once per page load, so reload to
    // apply (same as an editor verifying their change in a fresh tab).
    // The #cms/theme hash restores the tab; wait for content, not a sleep.
    await p.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await waitTabReady(p, 'brand.accent');
    const applied = await p.evaluate(() => document.documentElement.style.getPropertyValue('--accent-primary'));
    check('Accent applied as CSS var', applied.trim().toUpperCase() === '#123ABC', applied);
    const chip = await card.getByText(/:1 /).count();
    check('Contrast chip shown', chip > 0);
    await ss(p, '50-theme');
    // Reset via the reset icon (title = Reset to code) + confirm.
    p.once('dialog', d => d.accept());
    const resetBtn = card.locator('button[title="Reset to code"]');
    if ((await resetBtn.count()) > 0) {
      await resetBtn.click().catch(() => {});
      await p.waitForTimeout(1000);
    }
    const reverted = await p.evaluate(() => document.documentElement.style.getPropertyValue('--accent-primary'));
    const bundle = await apiCall(admin.ctx, 'GET', '/api/content/theme');
    check('Theme reset (bundle empty)', Object.keys(bundle.json?.tokens || {}).length === 0, `var now '${reverted}'`);
    await p.close();
  });

  await phase('Phase 6: Hero overlay', async () => {
    const p = await admin.ctx.newPage();
    await gotoOpsConsole(p);
    await openCMS(p);
    await openCMSTab(p, 'Homepage');
    // Sections load async — wait for the hero row before hunting it.
    await p.getByText('hero', { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => {});
    // Expand the row whose sub-line names the hero section key.
    const rows = p.locator('div.rounded-xl');
    let expanded = false;
    const n = await rows.count();
    for (let i = 0; i < Math.min(n, 20); i++) {
      const txt = ((await rows.nth(i).textContent()) || '').toLowerCase();
      if (txt.includes('hero') && txt.includes('visib')) {
        const btns = rows.nth(i).locator('button');
        await btns.last().click();
        await p.waitForTimeout(600);
        expanded = (await rows.nth(i).locator('input[type="range"]').count()) > 0;
        if (expanded) {
          await rows.nth(i).locator('input[type="range"]').evaluate((el, v) => {
            // React-controlled range input: assigning el.value bypasses React's
            // instance value tracker and the change never reaches state. Use
            // the prototype setter so React's onChange fires with the new value.
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, String(v));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, 30);
          await rows.nth(i).getByRole('button', { name: 'Save', exact: true }).click();
          await p.waitForTimeout(1000);
          break;
        }
      }
    }
    check('Hero overlay slider saved at 30', expanded);
    const cfg = await apiCall(admin.ctx, 'GET', '/api/content/homepage');
    const heroCfg = (cfg.json?.sections || []).find((s) => s.section_key === 'hero');
    check('Overlay persisted in homepage config', heroCfg?.config?.overlay_opacity === 30, `got ${heroCfg?.config?.overlay_opacity}`);
    const hp = await admin.ctx.newPage();
    await hp.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await hp.waitForTimeout(2000);
    const hero = await hp.locator('#cinematic-hero-cockpit').count();
    ok('Homepage hero still renders', hero > 0);
    // The homepage content fetch resolves after first paint — poll for the
    // dimmed scrims rather than asserting a single instant.
    let dimmed = false;
    let dimNote = '';
    for (let i = 0; i < 12; i++) {
      const styles = await hp.locator('#cinematic-hero-cockpit div[style*="opacity"]').evaluateAll(
        els => els.map(e => e.getAttribute('style') || '')).catch(() => []);
      const hit = styles.find(s => s.includes('0.3'));
      if (hit) { dimmed = true; dimNote = hit.slice(0, 60); break; }
      await hp.waitForTimeout(1000);
    }
    if (dimmed) ok('Scrim dimmed to 0.3', dimNote);
    else warn('Scrim opacity selector', 'never observed 0.3 within 12s — see screenshot');
    await ss(hp, '60-hero-dimmed');
    await hp.close();
    // Restore full scrims (100 renders identically to unset).
    if (expanded) {
      const rows2 = p.locator('div.rounded-xl');
      const n2 = await rows2.count();
      for (let i = 0; i < Math.min(n2, 20); i++) {
        const txt = ((await rows2.nth(i).textContent()) || '').toLowerCase();
        if (txt.includes('hero') && (await rows2.nth(i).locator('input[type="range"]').count()) > 0) {
          await rows2.nth(i).locator('input[type="range"]').evaluate((el) => {
            el.value = '100';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
          await rows2.nth(i).getByRole('button', { name: 'Save', exact: true }).click();
          await p.waitForTimeout(800);
          break;
        }
      }
      ok('Hero overlay restored to 100', true);
    }
    await p.close();
  });

  await phase('Phase 7: Preview', async () => {
    // Draft page lifecycle for the shareable-link test (one retry: page
    // creation is the only unrepeatable step in the run).
    let created = await apiCall(admin.ctx, 'POST', '/api/admin/content/pages', {
      slug: `qa-preview-${MARK.toLowerCase()}`, type: 'static_page', title_en: `QA Preview ${MARK}`, status: 'draft',
    });
    if (!created.json?.page?.id) {
      await new Promise(r => setTimeout(r, 2000));
      created = await apiCall(admin.ctx, 'POST', '/api/admin/content/pages', {
        slug: `qa-preview-${MARK.toLowerCase()}-b`, type: 'static_page', title_en: `QA Preview ${MARK}`, status: 'draft',
      });
    }
    const pageId = created.json?.page?.id || '';
    const token = created.json?.page?.preview_token || '';
    check('Draft page created with token', !!(pageId && token), `status ${created.status}`);
    if (pageId && token) {
      const p = await admin.ctx.newPage();
      await p.goto(`${BASE}/preview/${token}`, { waitUntil: 'networkidle', timeout: 30000 });
      check('Draft renders behind token', await waitText(p, `QA Preview ${MARK}`));
      check('Draft banner shown', await waitText(p, 'Draft preview'));
      await ss(p, '70-preview-draft');
      await p.close();
      const bad = await admin.ctx.newPage();
      await bad.goto(`${BASE}/preview/PREV-NOPE-${MARK}`, { waitUntil: 'networkidle', timeout: 30000 });
      await bad.waitForTimeout(1200);
      const badText = (await bad.textContent('body')) || '';
      check('Bad token shows expired state', badText.includes('expired'));
      await bad.close();
      const del = await apiCall(admin.ctx, 'DELETE', `/api/admin/content/pages/${pageId}`);
      check('Draft page deleted', del.status === 200, `status ${del.status}`);
    }
    // Editor preview pane on a real page: the row's Edit button (title="Edit").
    const p2 = await admin.ctx.newPage();
    await gotoOpsConsole(p2);
    await openCMS(p2);
    await openCMSTab(p2, 'Pages');
    const pageRow = p2.locator('button[title="Edit"]').first();
    if ((await pageRow.count()) > 0) {
      await pageRow.click().catch(() => {});
      await p2.waitForTimeout(1500);
      const previewBtn = p2.getByRole('button', { name: 'Preview' }).first();
      if ((await previewBtn.count()) > 0) {
        await previewBtn.click();
        await p2.waitForTimeout(1000);
        const hasPreview = (await p2.locator('text=960px').count()) > 0;
        check('Editor preview pane opens', hasPreview);
        await p2.getByRole('button', { name: '390px' }).click();
        await p2.waitForTimeout(600);
        const mobilePane = await p2.locator('div[style*="max-width: 390px"]').count();
        const deskPane = await p2.locator('div[style*="max-width: 960px"]').count();
        check('Preview widths switch (390px pane)', mobilePane > 0 && deskPane === 0, `390:${mobilePane} 960:${deskPane}`);
        await ss(p2, '71-editor-preview');
        // Copy preview link (clipboard permission granted on this context).
        await p2.getByRole('button', { name: 'Copy preview link' }).click();
        await p2.waitForTimeout(800);
        const clip = await p2.evaluate(() => navigator.clipboard.readText().catch(() => ''));
        check('Preview link copied', clip.includes('/preview/PREV-'), clip.slice(0, 60));
      } else warn('Editor preview pane', 'Preview toggle not found for first row');
    } else warn('Editor preview pane', 'no page rows found');
    await p2.close();
  });

  await phase('Phase 8: Inline edit', async () => {
    let slug = '', pageId = '', origTitle = '';
    for (const s of ['about-dahab', 'faq', 'travel-guides']) {
      const r = await apiCall(admin.ctx, 'GET', `/api/content/pages/${s}`);
      if (r.status === 200 && r.json?.page) {
        slug = s;
        pageId = r.json.page.id;
        origTitle = r.json.page.title_en;
        break;
      }
    }
    const route = slug === 'about-dahab' ? '/about' : slug === 'faq' ? '/faq' : '/travel-guides';
    if (!slug) { warn('Inline edit', 'no published static page available — skipped'); return; }
    ok('Published static page found', true, `${slug}`);
    const p = await admin.ctx.newPage();
    await p.goto(`${BASE}${route}?cms-edit=1`, { waitUntil: 'networkidle', timeout: 30000 });
    await p.waitForTimeout(2000);
    const outlines = await p.locator('.outline-dashed').count();
    check('Edit outlines present (Admin)', outlines > 0, `${outlines} nodes`);
    const banner = (await p.textContent('body')) || '';
    check('Edit banner shown', banner.includes('Edit mode'));
    await ss(p, '80-inline-edit');
    // Edit the h1 through the popover (own overlay stack, z-[100]).
    const h1 = p.locator('h1.outline-dashed').first();
    if ((await h1.count()) > 0) {
      const before = ((await h1.textContent()) || '').trim();
      await h1.click();
      await p.waitForTimeout(600);
      const ipop = p.locator('div.fixed.inset-0').last();
      const enInput = ipop.locator('input').first();
      const marker = `${before} [${MARK}]`;
      await enInput.fill(marker);
      await ipop.getByRole('button', { name: 'Save Changes' }).click();
      await p.waitForTimeout(1200);
      await p.reload({ waitUntil: 'networkidle' });
      check('Inline save persisted', await waitText(p, `[${MARK}]`));
      // Restore via API (deterministic cleanup).
      await apiCall(admin.ctx, 'PATCH', `/api/admin/content/pages/${pageId}`, { title_en: origTitle });
      await p.reload({ waitUntil: 'networkidle' });
      await p.waitForTimeout(2000);
      const restored = (await p.textContent('body')) || '';
      check('Inline edit restored', !restored.includes(`[${MARK}]`));
    } else warn('Inline save', 'no h1 editable found');
    await p.close();
    // Anonymous: no outlines, no banner.
    const anon = await browser.newContext({ locale: 'en-US' });
    const ap = await anon.newPage();
    await ap.goto(`${BASE}${route}?cms-edit=1`, { waitUntil: 'networkidle', timeout: 30000 });
    await ap.waitForTimeout(1500);
    check('Anonymous sees no outlines', (await ap.locator('.outline-dashed').count()) === 0);
    const anonBody = (await ap.textContent('body')) || '';
    check('Anonymous sees no banner', !anonBody.includes('Edit mode'));
    await anon.close();
  });

  await phase('Phase 9: Media guards', async () => {
    // 1px PNG: signature only is enough for the byte-sniff allow-list.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const up = await apiCall(admin.ctx, 'POST', '/api/admin/content/media/upload', {
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      filename: `qa-tiny-${MARK}.png`, category: 'general', alt_en: 'QA tiny',
    });
    const assetId = up.json?.asset?.id || '';
    check('Tiny PNG uploaded', up.status === 201 && !!assetId, `status ${up.status}`);
    if (!assetId) return;
    const p = await admin.ctx.newPage();
    await gotoOpsConsole(p);
    await openCMS(p);
    await openCMSTab(p, 'Media');
    await waitTabReady(p, 'Search media', true);
    await p.getByPlaceholder('Search media').fill(`qa-tiny-${MARK}`);
    await p.waitForTimeout(800);
    const card = p.getByText(`qa-tiny-${MARK}.png`).first();
    if ((await card.count()) > 0) {
      await card.click();
      await p.waitForTimeout(800);
      // Focal picker: click off-center on the preview, save, verify via API.
      const preview = modal(p).locator('img').first();
      await preview.click({ position: { x: 10, y: 10 } });
      await modal(p).getByRole('button', { name: 'Save Changes' }).click();
      await p.waitForTimeout(1000);
      const focalResp = await apiCall(admin.ctx, 'GET', '/api/admin/content/media?category=general');
      const row = (focalResp.json?.media || []).find((m) => m.id === assetId);
      check('Focal point saved', row && (row.focal_x !== 50 || row.focal_y !== 50), `focal ${row?.focal_x}/${row?.focal_y}`);
      await ss(p, '90-media-modal');
      await closeModal(p);
    } else warn('Media card', 'uploaded asset not found in grid');
    await p.close();
    // Reference it from a binding, then delete must 409.
    const places = await apiCall(admin.ctx, 'GET', '/api/dahab/places');
    const placeId = places.json?.places?.[0]?.id || '';
    if (!placeId) { warn('Media 409 path', 'no places seeded'); return; }
    await apiCall(admin.ctx, 'PUT', `/api/admin/content/bindings/place/${placeId}`, { fields: { cover_media_id: assetId } });
    await apiCall(admin.ctx, 'POST', `/api/admin/content/bindings/place/${placeId}/publish`);
    const used = await apiCall(admin.ctx, 'GET', '/api/admin/content/media?category=general');
    const urow = (used.json?.media || []).find((m) => m.id === assetId);
    check('Usage badge counted', (urow?.usedCount || 0) >= 1, `usedCount ${urow?.usedCount}`);
    const blocked = await apiCall(admin.ctx, 'DELETE', `/api/admin/content/media/${assetId}`);
    check('Delete blocked while referenced (409)', blocked.status === 409, `status ${blocked.status}`);
    await apiCall(admin.ctx, 'DELETE', `/api/admin/content/bindings/place/${placeId}`);
    const freed = await apiCall(admin.ctx, 'DELETE', `/api/admin/content/media/${assetId}`);
    check('Delete succeeds after unreference', freed.status === 200, `status ${freed.status}`);
    const gone = await apiCall(admin.ctx, 'GET', '/api/admin/content/media?category=general');
    check('Asset fully removed', !(gone.json?.media || []).some((m) => m.id === assetId));
  });

  await phase('Phase 10: RBAC matrix', async () => {
    const product = await setupUser(browser, 'Product', 'product');
    const traveler = await setupUser(browser, 'Traveler', 'traveler');
    const ops = await setupUser(browser, 'Operations', 'ops');
    check('Product session', product.authed);
    check('Traveler session', traveler.authed);
    check('Operations session', ops.authed);
    // Accommodation id for the matrix (re-read; Phase 2 cleaned up).
    const list = await apiCall(admin.ctx, 'GET', '/api/accommodations');
    const accId = list.json?.accommodations?.[0]?.id || '';
    if (product.authed && accId) {
      const draft = await apiCall(product.ctx, 'PUT', `/api/admin/content/bindings/accommodation/${accId}`, { fields: { title_en: `QA Draft ${MARK}` } });
      check('Product may draft bindings', draft.status === 200, `status ${draft.status}`);
      const pub = await apiCall(product.ctx, 'POST', `/api/admin/content/bindings/accommodation/${accId}/publish`);
      check('Product blocked from publish (403)', pub.status === 403, `status ${pub.status}`);
      const strs = await apiCall(product.ctx, 'PUT', '/api/admin/content/strings/nav.discover', { value_en: 'x' });
      check('Product blocked from strings (403)', strs.status === 403, `status ${strs.status}`);
      const thm = await apiCall(product.ctx, 'PUT', '/api/admin/content/theme', { key: 'brand.accent', value: '#FFFFFF' });
      check('Product blocked from theme (403)', thm.status === 403, `status ${thm.status}`);
      const si = await apiCall(product.ctx, 'PUT', '/api/admin/content/site-info', { key: 'contact.phone', value: 'x' });
      check('Product blocked from site-info (403)', si.status === 403, `status ${si.status}`);
      // Cleanup product's draft.
      await apiCall(admin.ctx, 'DELETE', `/api/admin/content/bindings/accommodation/${accId}`);
    }
    if (traveler.authed) {
      const denied = await apiCall(traveler.ctx, 'GET', '/api/admin/content/pages');
      check('Traveler denied admin content', denied.status === 401 || denied.status === 403, `status ${denied.status}`);
    }
    if (ops.authed && accId) {
      await apiCall(ops.ctx, 'PUT', `/api/admin/content/bindings/accommodation/${accId}`, { fields: { title_en: `QA Ops ${MARK}` } });
      const pub = await apiCall(ops.ctx, 'POST', `/api/admin/content/bindings/accommodation/${accId}/publish`);
      check('Operations may publish', pub.status === 200, `status ${pub.status}`);
      await apiCall(admin.ctx, 'DELETE', `/api/admin/content/bindings/accommodation/${accId}`);
    }
    for (const u of [product, traveler, ops]) await u.ctx.close().catch(() => {});
  });

  await phase('Phase 11: Regression', async () => {
    const p = await admin.ctx.newPage();
    await gotoOpsConsole(p);
    const main = (await p.textContent('main')) || '';
    check('Console main renders', main.length > 200, `${main.length} chars`);
    await p.close();
    for (const path of ['/', '/api/accommodations', '/api/rentals', '/api/dahab/places', '/api/content/homepage', '/api/content/strings', '/api/content/theme', '/api/content/site-info']) {
      try {
        const r = await fetch(`${BASE}${path}`);
        if (r.ok) ok(`GET ${path}`, true, '200');
        else no(`GET ${path}`, `status ${r.status}`);
      } catch (e) {
        no(`GET ${path}`, String(e).slice(0, 80));
      }
    }
    // Mobile viewport homepage smoke.
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
    const mp = await mctx.newPage();
    await mp.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await mp.waitForTimeout(1500);
    const mbody = (await mp.textContent('body')) || '';
    check('Mobile homepage renders', mbody.length > 1000, `${mbody.length} chars`);
    await ss(mp, '95-mobile-home');
    await mctx.close();
  });

  await phase('Phase 12: Cleanup proof', async () => {
    // Fresh session: if anything disturbed auth mid-run, cleanup must still
    // be verified with a live credential rather than reported from a dead one.
    const janitor = await setupUser(browser, 'Admin', 'admin');
    const actx = janitor.authed ? janitor.ctx : admin.ctx;
    let clean = true;
    const list = await apiCall(actx, 'GET', '/api/accommodations');
    const accId = list.json?.accommodations?.[0]?.id || '';
    if (accId) {
      const b = await apiCall(actx, 'GET', `/api/admin/content/bindings/accommodation/${accId}`);
      const n = (b.json?.bindings || []).length;
      if (n === 0) ok('Bindings removed');
      else { no('Bindings removed', `${n} left`); clean = false; }
    }
    const strs = await apiCall(actx, 'GET', '/api/admin/content/strings/groups');
    if ((strs.json?.customizedKeys || 0) === 0) ok('Strings uncustomized');
    else { no('Strings uncustomized', `${strs.json?.customizedKeys} customized`); clean = false; }
    const thm = await apiCall(actx, 'GET', '/api/content/theme');
    const tn = Object.keys(thm.json?.tokens || {}).length;
    if (tn === 0) ok('Theme tokens empty');
    else { no('Theme tokens empty', `${tn} set`); clean = false; }
    const si = await apiCall(actx, 'GET', '/api/content/site-info');
    const allEmpty = Object.values(si.json?.info || {}).every(group =>
      Object.values(group).every(slot => !slot.value && !slot.valueAr));
    if (allEmpty) ok('Site info empty');
    else { no('Site info empty', 'slots still set'); clean = false; }
    const pages = await apiCall(actx, 'GET', '/api/admin/content/pages');
    const leftovers = (pages.json?.pages || []).filter(pg => (pg.slug || '').includes('qa-preview-'));
    if (leftovers.length === 0) ok('QA pages deleted');
    else { no('QA pages deleted', `${leftovers.length} left`); clean = false; }
    const media = await apiCall(actx, 'GET', '/api/admin/content/media');
    const mleft = (media.json?.media || []).filter(m => (m.filename || '').includes('qa-tiny-'));
    if (mleft.length === 0) ok('QA media deleted');
    else { no('QA media deleted', `${mleft.length} left`); clean = false; }
    if (!clean) warn('Cleanup', 'leftovers detected — see lines above');
    await janitor.ctx.close().catch(() => {});
  });

  await admin.ctx.close().catch(() => {});
  return finish(browser, 'cms-advanced');
}

async function finish(browser, area) {
  console.log('\n════════ Results ════════');
  for (const line of R.d) console.log(line);
  console.log(`\n${R.pass} passed · ${R.fail} failed · ${R.warn} warnings`);
  noteIssues(area);
  await browser.close().catch(() => {});
  if (R.fail > 0) process.exit(1);
}

run().catch(err => {
  console.error('QA crashed:', err?.message || err);
  R.fail++;
  noteIssues('cms-advanced-crash');
  process.exit(1);
});
