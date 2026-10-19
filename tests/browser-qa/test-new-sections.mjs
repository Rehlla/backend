import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sections = ['Transfers', 'Notifications', 'SMS Center', 'Opportunities', 'Market Jobs'];
  let pass = 0, fail = 0;
  
  for (const section of sections) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const email = `qa-${section.toLowerCase().replace(/\s/g, '-')}-${Date.now()}@dahab.travel`;
    const res = await c.request.post('http://localhost:3000/api/auth/register', {
      data: { name: 'QA', email, password: 'QA2026!', role: 'Admin' }
    });
    const cookie = res.headers()['set-cookie']?.match(/dahab_auth_token=([^;]+)/)?.[1];
    if (cookie) await c.addCookies([{ name: 'dahab_auth_token', value: cookie, domain: 'localhost', path: '/' }]);
    const p = await c.newPage();
    await p.goto('http://localhost:3000/ops-console', { waitUntil: 'networkidle', timeout: 20000 });
    await p.waitForTimeout(2000);
    
    const btns = await p.$$('aside nav button');
    let clicked = false;
    for (const btn of btns) {
      const txt = await btn.textContent();
      if (txt && txt.includes(section)) { await btn.click(); clicked = true; break; }
    }
    await p.waitForTimeout(1000);
    const text = await p.textContent('main') || '';
    const ok = clicked && text.length > 50;
    console.log(ok ? '✓' : '✗', section, ok ? '(loaded)' : '(FAILED)');
    if (ok) pass++; else fail++;
    await c.close();
  }
  
  console.log(`\nResult: ${pass}/${pass + fail} sections loaded`);
  await browser.close();
  if (fail > 0) process.exit(1);
})();
