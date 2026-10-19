/** Probe: Phase 4 site-info DOM — find every 'Phone' span and test the ancestor locator. */
import { chromium } from 'playwright';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:3100';
const HOST = new URL(BASE).hostname;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: 'en-US' });
const res = await ctx.request.post(`${BASE}/api/auth/login`, {
  data: { email: 'cmsqa-admin@dahab.travel', password: 'QA2026!' },
});
const cookie = res.headers()['set-cookie']?.match(/dahab_auth_token=([^;]+)/)?.[1];
await ctx.addCookies([{ name: 'dahab_auth_token', value: cookie, domain: HOST, path: '/' }]);

const p = await ctx.newPage();
await p.goto(`${BASE}/ops-console`, { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2500);
await p.getByRole('button', { name: 'CMS Content' }).first().click();
await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Site Info' }).first().click();
await p.waitForTimeout(1500);

const spans = p.locator('span', { hasText: 'Phone' });
console.log('spans matching Phone:', await spans.count());
for (let i = 0; i < await spans.count(); i++) {
  const txt = ((await spans.nth(i).textContent()) || '').trim();
  const anc = spans.nth(i).locator('xpath=./ancestor::div[contains(@class,"grid")][1]');
  console.log(`[${i}] text="${txt}" ancGrid=${await anc.count()}`);
}

const phoneRow = async () => {
  const lab = p.locator('span', { hasText: 'Phone' }).first();
  if ((await lab.count()) === 0) return null;
  return lab.locator('xpath=./ancestor::div[contains(@class,"grid")][1]');
};
const rowEl = await phoneRow();
const btns = rowEl.locator('button');
console.log('row buttons:', await btns.count());
for (let i = 0; i < await btns.count(); i++) {
  console.log(`  btn[${i}]:`, JSON.stringify(((await btns.nth(i).textContent()) || '').trim()), 'disabled=', await btns.nth(i).isDisabled().catch(() => '?'));
}
console.log('Save Changes matches:', await rowEl.getByRole('button', { name: 'Save Changes' }).count());

// First save
await rowEl.locator('input').first().fill('+201000000001');
await rowEl.getByRole('button', { name: 'Save Changes' }).click();
await p.waitForTimeout(1500);
console.log('--- after first save ---');
for (let i = 0; i < await btns.count(); i++) {
  console.log(`  btn[${i}]:`, JSON.stringify(((await btns.nth(i).textContent()) || '').trim()), 'disabled=', await btns.nth(i).isDisabled().catch(() => '?'));
}
console.log('Save Changes matches now:', await rowEl.getByRole('button', { name: 'Save Changes' }).count());
console.log('Notice text visible:', ((await rowEl.textContent()) || '').includes('✓'));

// Second save (clear)
await rowEl.locator('input').first().fill('');
await rowEl.getByRole('button', { name: 'Save Changes' }).click().then(() => console.log('second click OK')).catch(e => console.log('second click FAILED:', e.message.split('\n')[0]));
await browser.close();