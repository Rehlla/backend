/** Probe: Phase 9 media-grid search — upload a tiny PNG, search, inspect grid. */
import { chromium } from 'playwright';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:3102';
const HOST = new URL(BASE).hostname;
const MARK = Date.now().toString(36).toUpperCase();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: 'en-US' });
const res = await ctx.request.post(`${BASE}/api/auth/login`, {
  data: { email: 'cmsqa-admin@dahab.travel', password: 'QA2026!' },
});
const cookie = res.headers()['set-cookie']?.match(/dahab_auth_token=([^;]+)/)?.[1];
await ctx.addCookies([{ name: 'dahab_auth_token', value: cookie, domain: HOST, path: '/' }]);

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const up = await ctx.request.post(`${BASE}/api/admin/content/media/upload`, {
  data: { dataUrl: `data:image/png;base64,${png.toString('base64')}`, filename: `qa-tiny-${MARK}.png`, category: 'general', alt_en: 'QA tiny' },
});
const upJson = await up.json();
console.log('upload status:', up.status, 'asset id:', upJson.asset?.id, 'filename:', upJson.asset?.filename);

const p = await ctx.newPage();
await p.goto(`${BASE}/ops-console`, { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2500);
await p.getByRole('button', { name: 'CMS Content' }).first().click();
await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Media' }).first().click();
await p.waitForTimeout(1500);

const searchInputs = p.locator('input[placeholder*="Search" i]');
console.log('search inputs on page:', await searchInputs.count());
for (let i = 0; i < await searchInputs.count(); i++) {
  console.log(`  [${i}] placeholder=`, await searchInputs.nth(i).getAttribute('placeholder'));
}
const mediaSearch = p.getByPlaceholder('Search media');
console.log('getByPlaceholder(Search media) matches:', await mediaSearch.count().catch(() => 'ERR'));
if (await mediaSearch.count() > 0) {
  await mediaSearch.fill(`qa-tiny-${MARK}`);
  await p.waitForTimeout(1000);
  console.log('input value after fill:', JSON.stringify(await mediaSearch.inputValue()));
  const counter = p.locator('span').filter({ hasText: 'assets' }).first();
  console.log('counter text:', JSON.stringify(((await counter.textContent()) || '').trim()));
  const body = (await p.textContent('body')) || '';
  console.log('body contains filename:', body.includes(`qa-tiny-${MARK}`));
  console.log('card via getByText:', await p.getByText(`qa-tiny-${MARK}.png`).count());
  console.log('cards visible:', await p.locator('text=qa-tiny-').count());
  const names = await p.locator('div.truncate').allTextContents().catch(() => []);
  console.log('truncate texts:', JSON.stringify(names.slice(0, 8)));
}
// cleanup
await ctx.request.delete(`${BASE}/api/admin/content/media/${upJson.asset?.id}`);
await browser.close();