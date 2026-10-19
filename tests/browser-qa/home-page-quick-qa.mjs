/**
 * Home Page Quick QA — fast focused checks on the sections we changed.
 * Takes viewport-only screenshots (not full-page) to stay fast.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/browser-qa/screenshots/home-page', { recursive: true });

const BASE = 'http://localhost:3000';

async function setupAuth(ctx) {
  const email = `hqa-${Date.now()}@dahab.travel`;
  const res = await ctx.request.post(`${BASE}/api/auth/register`, {
    data: { name: 'QA', email, password: 'QA2026!', role: 'Traveler' }
  });
  const h = res.headers()['set-cookie'];
  if (h) {
    const m = h.match(/dahab_auth_token=([^;]+)/);
    if (m) await ctx.addCookies([{ name: 'dahab_auth_token', value: m[1], domain: 'localhost', path: '/' }]);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const issues = [];
  function issue(sev, area, desc, vp) {
    issues.push({ sev, area, desc, vp });
    const icon = sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🔵';
    console.log(`  ${icon} [${area}] ${desc}${vp ? ` (${vp})` : ''}`);
  }

  // ── Desktop 1440px — Charcoal ────────────────────────────
  console.log('\n━━━ Desktop 1440px — Charcoal Theme ━━━');
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(ctx);
  let page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme-id', 'charcoal-minimal');
    document.body.setAttribute('data-theme-id', 'charcoal-minimal');
  });
  await page.waitForTimeout(300);

  // Hero viewport
  const hero = await page.$('#cinematic-hero-cockpit');
  if (hero) {
    await hero.screenshot({ path: 'tests/browser-qa/screenshots/home-page/desktop-hero.png' });
    console.log('  ✅ Hero captured');
  }

  // Check hero h1
  const h1Info = await page.evaluate(() => {
    const h1 = document.querySelector('#cinematic-hero-cockpit h1');
    if (!h1) return null;
    const s = getComputedStyle(h1);
    return { color: s.color, bg: s.backgroundColor, size: s.fontSize };
  });
  if (h1Info) console.log(`  📐 Hero h1: color=${h1Info.color} size=${h1Info.size}`);

  // Scroll to trip entry
  const tripEntry = await page.$('#how-do-you-want-to-experience-dahab');
  if (tripEntry) {
    await tripEntry.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await tripEntry.screenshot({ path: 'tests/browser-qa/screenshots/home-page/desktop-trip-entry.png' });
    console.log('  ✅ Trip entry captured');
  }

  // Check pathway cards
  const cards = await page.evaluate(() => {
    const results = [];
    for (const id of ['pathway-build-myself', 'pathway-ready-trips', 'pathway-plan-it-for-me']) {
      const el = document.getElementById(id);
      if (!el) continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      results.push({ id, bg: s.backgroundColor, border: s.borderColor, w: Math.round(r.width), h: Math.round(r.height) });
    }
    return results;
  });
  for (const c of cards) {
    console.log(`  📐 ${c.id}: ${c.w}x${c.h}px bg=${c.bg} border=${c.border}`);
  }

  // Scroll to quick services
  const quickGrid = await page.$('#quick-trip-services-grid');
  if (quickGrid) {
    await quickGrid.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await quickGrid.screenshot({ path: 'tests/browser-qa/screenshots/home-page/desktop-quick-services.png' });
    console.log('  ✅ Quick services captured');
  }

  // Check grid card sizes
  const gridCards = await page.evaluate(() => {
    const grid = document.querySelector('#quick-trip-services-grid .grid');
    if (!grid) return [];
    return Array.from(grid.children).map(el => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
  });
  console.log(`  📐 Grid cards: ${gridCards.map(c => `${c.w}x${c.h}`).join(', ')}`);

  // Footer
  const footer = await page.$('footer[role="contentinfo"]');
  if (footer) {
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await footer.screenshot({ path: 'tests/browser-qa/screenshots/home-page/desktop-footer.png' });
    console.log('  ✅ Footer captured');
    const fLinks = await footer.$$eval('button', els => els.length);
    console.log(`  📐 Footer links: ${fLinks}`);
  } else {
    issue('high', 'footer', 'Footer with role=contentinfo not found');
  }

  // Horizontal overflow check
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    view: window.innerWidth,
  }));
  if (overflow.doc > overflow.view + 2) {
    issue('high', 'overflow', `Horizontal overflow: ${overflow.doc}px > ${overflow.view}px`);
  } else {
    console.log(`  ✅ No horizontal overflow (doc=${overflow.doc}px view=${overflow.view}px)`);
  }

  // Section nav check
  const navCount = await page.$$eval('nav[aria-label] button[data-section]', els => els.length);
  console.log(`  📐 Section nav buttons: ${navCount}`);

  await ctx.close();

  // ── Desktop 1440px — Editorial Sand (light theme) ───────
  console.log('\n━━━ Desktop 1440px — Editorial Sand (Light) ━━━');
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(ctx);
  page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme-id', 'editorial-sand');
    document.body.setAttribute('data-theme-id', 'editorial-sand');
  });
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'tests/browser-qa/screenshots/home-page/desktop-sand-hero.png' });
  console.log('  ✅ Sand hero captured');

  // Check text contrast on light theme
  const lightContrast = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('#cinematic-hero-cockpit h1, #cinematic-hero-cockpit p').forEach(el => {
      const s = getComputedStyle(el);
      results.push({ tag: el.tagName, color: s.color, text: el.textContent?.substring(0, 30) });
    });
    return results;
  });
  for (const c of lightContrast) {
    console.log(`  📐 ${c.tag}: color=${c.color} "${c.text}"`);
  }

  // Trip entry on light theme
  const tripLight = await page.$('#how-do-you-want-to-experience-dahab');
  if (tripLight) {
    await tripLight.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await tripLight.screenshot({ path: 'tests/browser-qa/screenshots/home-page/desktop-sand-trip-entry.png' });
    console.log('  ✅ Sand trip entry captured');
  }

  await ctx.close();

  // ── Mobile 390px — Charcoal ─────────────────────────────
  console.log('\n━━━ Mobile 390px — Charcoal ━━━');
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await setupAuth(ctx);
  page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme-id', 'charcoal-minimal');
    document.body.setAttribute('data-theme-id', 'charcoal-minimal');
  });
  await page.waitForTimeout(300);

  // Hero mobile
  const heroM = await page.$('#cinematic-hero-cockpit');
  if (heroM) {
    await heroM.screenshot({ path: 'tests/browser-qa/screenshots/home-page/mobile-hero.png' });
    console.log('  ✅ Mobile hero captured');
  }

  // Check hero doesn't overflow
  const mobileOverflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    view: window.innerWidth,
  }));
  if (mobileOverflow.doc > mobileOverflow.view + 2) {
    issue('high', 'overflow', `Mobile horizontal overflow: ${mobileOverflow.doc}px > ${mobileOverflow.view}px`, '390px');
  } else {
    console.log(`  ✅ No mobile overflow (${mobileOverflow.doc}px)`);
  }

  // CTA button sizes
  const ctaSizes = await page.$$eval('#hero-start-trip-cta, #hero-browse-experiences-cta', els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      return { id: el.id, h: Math.round(r.height), w: Math.round(r.width) };
    })
  );
  for (const btn of ctaSizes) {
    console.log(`  📐 ${btn.id}: ${btn.w}x${btn.h}px`);
    if (btn.h < 44) issue('medium', 'a11y', `CTA "${btn.id}" height ${btn.h}px < 44px min`, '390px');
  }

  // Scroll to trip entry on mobile
  const tripM = await page.$('#how-do-you-want-to-experience-dahab');
  if (tripM) {
    await tripM.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await tripM.screenshot({ path: 'tests/browser-qa/screenshots/home-page/mobile-trip-entry.png' });
    console.log('  ✅ Mobile trip entry captured');
  }

  // Check pathway cards stack vertically
  const mobileCards = await page.evaluate(() => {
    const grid = document.querySelector('#trip-entry-doorways-grid');
    if (!grid) return null;
    const s = getComputedStyle(grid);
    const children = Array.from(grid.children).map(el => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
    });
    return { cols: s.gridTemplateColumns, children };
  });
  if (mobileCards) {
    console.log(`  📐 Mobile card grid: ${mobileCards.cols}`);
    const allSameWidth = mobileCards.children.every(c => Math.abs(c.w - mobileCards.children[0].w) < 5);
    console.log(`  📐 Cards same width: ${allSameWidth}`);
    const stacked = mobileCards.children.every((c, i) => i === 0 || c.y > mobileCards.children[i - 1].y);
    console.log(`  📐 Cards stacked vertically: ${stacked}`);
  }

  // Quick services mobile
  const quickM = await page.$('#quick-trip-services-grid');
  if (quickM) {
    await quickM.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await quickM.screenshot({ path: 'tests/browser-qa/screenshots/home-page/mobile-quick-services.png' });
    console.log('  ✅ Mobile quick services captured');
  }

  await ctx.close();

  // ── Tablet 768px — Charcoal ─────────────────────────────
  console.log('\n━━━ Tablet 768px — Charcoal ━━━');
  ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await setupAuth(ctx);
  page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme-id', 'charcoal-minimal');
    document.body.setAttribute('data-theme-id', 'charcoal-minimal');
  });
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'tests/browser-qa/screenshots/home-page/tablet-hero.png' });
  console.log('  ✅ Tablet hero captured');

  const tabOverflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    view: window.innerWidth,
  }));
  if (tabOverflow.doc > tabOverflow.view + 2) {
    issue('high', 'overflow', `Tablet overflow: ${tabOverflow.doc}px`, '768px');
  } else {
    console.log(`  ✅ No tablet overflow (${tabOverflow.doc}px)`);
  }

  await ctx.close();

  // ── Summary ──────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total issues: ${issues.length}`);
  const high = issues.filter(i => i.sev === 'high');
  const med = issues.filter(i => i.sev === 'medium');
  console.log(`  🔴 High: ${high.length}  🟡 Medium: ${med.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  if (high.length > 0) {
    console.log('High issues to fix:');
    high.forEach(i => console.log(`  🔴 [${i.area}] ${i.desc}`));
  }

  await browser.close();
}

run().catch(err => {
  console.error('QA failed:', err.message);
  process.exit(1);
});
