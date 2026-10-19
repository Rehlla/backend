/** Probe: reproduce QA Phase 6 hero-overlay flow, capturing the PATCH body. */
import { chromium } from 'playwright';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:3100';
const HOST = new URL(BASE).hostname;

async function login(browser) {
  const ctx = await browser.newContext({ locale: 'en-US' });
  const res = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { email: 'cmsqa-admin@dahab.travel', password: 'QA2026!' },
  });
  const cookie = res.headers()['set-cookie']?.match(/dahab_auth_token=([^;]+)/)?.[1];
  if (!cookie) throw new Error('login failed');
  await ctx.addCookies([{ name: 'dahab_auth_token', value: cookie, domain: HOST, path: '/' }]);
  return ctx;
}

const browser = await chromium.launch({ headless: true });
const ctx = await login(browser);
const p = await ctx.newPage();
const patches = [];
p.on('request', req => {
  if (req.method() === 'PATCH' && req.url().includes('/homepage/')) {
    patches.push({ url: req.url(), body: req.postData() });
  }
});
p.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 200)));

await p.goto(`${BASE}/ops-console`, { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2500);
await p.getByRole('button', { name: 'CMS Content' }).first().click();
await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Homepage' }).first().click();
await p.waitForTimeout(800);

const rows = p.locator('div.rounded-xl');
const n = await rows.count();
console.log('rounded-xl rows:', n);
let matched = -1;
for (let i = 0; i < Math.min(n, 20); i++) {
  const txt = ((await rows.nth(i).textContent()) || '').toLowerCase();
  if (txt.includes('hero') && txt.includes('visib')) { matched = i; console.log(`hero row at idx ${i}:`, txt.slice(0, 120)); break; }
}
if (matched < 0) { console.log('NO HERO ROW FOUND'); process.exit(1); }

const btns = rows.nth(matched).locator('button');
console.log('row button count:', await btns.count());
await btns.last().click();
await p.waitForTimeout(600);
const range = rows.nth(matched).locator('input[type="range"]');
console.log('range count after expand:', await range.count());
if (await range.count() > 0) {
  console.log('range current value:', await range.inputValue());
  await range.evaluate((el, v) => {
    // React-controlled range: bypass the instance value tracker by using the
    // prototype setter, then signal the change so React's onChange fires.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, 30);
  await p.waitForTimeout(500);
  console.log('range value after dispatch:', await range.inputValue());
  const saveBtn = rows.nth(matched).getByRole('button', { name: 'Save', exact: true });
  console.log('Save buttons in row:', await saveBtn.count());
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await p.waitForTimeout(1500);
    console.log('PATCH requests captured:', patches.length);
    for (const patch of patches) console.log('  PATCH', patch.url.replace(BASE, ''), '→', patch.body?.slice(0, 300));
    const r = await ctx.request.fetch(`${BASE}/api/content/homepage`, { timeout: 30000 });
    const data = await r.json();
    const hero = data.sections.find(s => s.section_key === 'hero');
    console.log('public hero config:', JSON.stringify(hero?.config));
  }
}
await browser.close();