/**
 * Visual Diagnostics — identifies specific UI issues to fix.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('tests/browser-qa/screenshots', { recursive: true });

const BASE = 'http://localhost:3000';
const OPS = `${BASE}/ops-console`;

async function setupAuth(ctx) {
  const email = `diag-${Date.now()}@dahab.travel`;
  const res = await ctx.request.post(`${BASE}/api/auth/register`, {
    data: { name: 'Diag Ops', email, password: 'QA2026!', role: 'Admin' }
  });
  const h = res.headers()['set-cookie'];
  if (h) {
    const m = h.match(/dahab_auth_token=([^;]+)/);
    if (m) await ctx.addCookies([{ name: 'dahab_auth_token', value: m[1], domain: 'localhost', path: '/' }]);
  }
  return email;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const issues = [];

  function issue(severity, area, desc) {
    issues.push({ severity, area, desc });
    console.log(`  ${severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🔵'} [${area}] ${desc}`);
  }

  // ── Overview at 1440px ───────────────────────────────────────
  console.log('\n━━━ Overview (1440px) ━━━');
  const c1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c1);
  const p1 = await c1.newPage();
  await p1.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p1.waitForTimeout(3000);

  // Check sidebar width
  const sidebarW = await p1.$eval('aside', el => el.getBoundingClientRect().width);
  console.log(`  Sidebar width: ${sidebarW}px`);
  if (sidebarW > 250) issue('medium', 'sidebar', `Sidebar too wide: ${sidebarW}px (target: 224px)`);

  // Check main content padding
  const mainPad = await p1.$eval('main > div', el => {
    const s = getComputedStyle(el);
    return { pt: s.paddingTop, pl: s.paddingLeft, pr: s.paddingRight };
  });
  console.log(`  Main padding: top=${mainPad.pt} left=${mainPad.pl} right=${mainPad.pr}`);

  // Check stat card alignment
  const cardRects = await p1.$$eval('.grid button', els =>
    els.slice(0, 4).map(el => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
    })
  );
  console.log(`  First 4 stat cards:`, JSON.stringify(cardRects));
  const heights = cardRects.map(c => c.h);
  if (Math.max(...heights) - Math.min(...heights) > 4) {
    issue('medium', 'overview', `Stat cards have uneven heights: ${heights.join(', ')}`);
  }

  // Check action queue vs health panel proportions
  const layoutCols = await p1.$$eval('.grid.lg\\:grid-cols-3 > div', els =>
    els.map(el => ({ w: Math.round(el.getBoundingClientRect().width), classes: el.className }))
  );
  console.log(`  3-col layout:`, JSON.stringify(layoutCols.map(c => c.w)));

  // Check text overflow / truncation
  const overflows = await p1.evaluate(() => {
    const problems = [];
    document.querySelectorAll('main *').forEach(el => {
      if (el.scrollWidth > el.clientWidth + 2 && el.textContent?.trim()) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className?.substring(0, 30) || '';
        const text = el.textContent?.substring(0, 40);
        if (!el.closest('[class*="truncate"]') && !el.closest('[class*="overflow"]')) {
          problems.push(`${tag}.${cls}: "${text}..." overflows (${el.scrollWidth}>${el.clientWidth})`);
        }
      }
    });
    return problems.slice(0, 10);
  });
  if (overflows.length > 0) {
    issue('medium', 'overflow', `${overflows.length} elements with text overflow:`);
    overflows.forEach(o => console.log(`    → ${o}`));
  } else {
    console.log('  ✓ No unhandled text overflow');
  }

  // Check status colors are distinguishable
  const statusBanners = await p1.$$eval('.rounded-2xl.border', els =>
    els.slice(0, 2).map(el => ({
      bg: getComputedStyle(el).backgroundColor,
      border: getComputedStyle(el).borderColor,
    }))
  );
  console.log(`  Status banner colors:`, JSON.stringify(statusBanners));

  // Check card spacing consistency
  const cardGaps = await p1.$$eval('.grid.gap-3', els =>
    els.map(el => ({
      gap: getComputedStyle(el).gap,
      childCount: el.children.length,
    }))
  );
  console.log(`  Grid gaps:`, JSON.stringify(cardGaps));

  // Check font sizes consistency
  const fontSizes = await p1.evaluate(() => {
    const sizes = new Map();
    document.querySelectorAll('main [class*="text-"]').forEach(el => {
      const s = getComputedStyle(el).fontSize;
      const clsStr = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
      const cls = clsStr.match(/text-(\[[^\]]+\]|[a-z]+-\d+)/)?.[0] || 'unknown';
      if (!sizes.has(s)) sizes.set(s, []);
      sizes.get(s).push(cls);
    });
    return Object.fromEntries(sizes);
  });
  console.log(`  Font sizes:`, JSON.stringify(fontSizes, null, 0));

  await p1.screenshot({ path: 'tests/browser-qa/screenshots/diag-overview-1440.png' });
  await c1.close();

  // ── Overview at 1024px ──────────────────────────────────────
  console.log('\n━━━ Overview (1024px Tablet) ━━━');
  const c2 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await setupAuth(c2);
  const p2 = await c2.newPage();
  await p2.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p2.waitForTimeout(3000);

  const sidebar2 = await p2.$eval('aside', el => el.getBoundingClientRect().width);
  const mainW2 = await p2.$eval('main', el => el.getBoundingClientRect().width);
  console.log(`  Sidebar: ${sidebar2}px, Main: ${mainW2}px`);
  if (mainW2 < 500) issue('high', 'layout', `Main content too narrow at 1024px: ${mainW2}px (sidebar: ${sidebar2}px)`);

  // Check if stat cards stack properly
  const gridCols2 = await p2.$$eval('.grid-cols-2, .grid-cols-4', els =>
    els.map(el => ({
      display: getComputedStyle(el).gridTemplateColumns,
      childCount: el.children.length,
    }))
  );
  console.log(`  Grid columns at 1024:`, JSON.stringify(gridCols2));

  // Check body text readability
  const bodyFont = await p2.evaluate(() => {
    const el = document.querySelector('main');
    return el ? getComputedStyle(el).fontSize : 'N/A';
  });
  console.log(`  Body font size: ${bodyFont}`);

  await p2.screenshot({ path: 'tests/browser-qa/screenshots/diag-overview-1024.png' });
  await c2.close();

  // ── Command Palette ──────────────────────────────────────────
  console.log('\n━━━ Command Palette ━━━');
  const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c3);
  const p3 = await c3.newPage();
  await p3.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p3.waitForTimeout(2000);

  await p3.keyboard.press('Control+k');
  await p3.waitForTimeout(500);

  // Check palette positioning
  const palRect = await p3.$eval('.fixed.inset-0.z-50 > div:not(.absolute)', el => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log(`  Palette rect:`, JSON.stringify(palRect));
  if (palRect.y < 50 || palRect.y > 400) {
    issue('medium', 'palette', `Palette vertical position seems off: y=${palRect.y}px`);
  }

  // Check palette input focus
  const inputFocused = await p3.evaluate(() => document.activeElement?.tagName === 'INPUT');
  console.log(`  Input auto-focused: ${inputFocused}`);
  if (!inputFocused) issue('medium', 'palette', 'Input not auto-focused when palette opens');

  // Check backdrop opacity
  const backdrop = await p3.$eval('.fixed.inset-0.z-50 > .absolute', el => ({
    bg: getComputedStyle(el).backgroundColor,
    blur: getComputedStyle(el).backdropFilter,
  }));
  console.log(`  Backdrop:`, JSON.stringify(backdrop));

  // Check palette items height
  const itemHeights = await p3.$$eval('.fixed.inset-0.z-50 button', els =>
    els.slice(0, 5).map(el => Math.round(el.getBoundingClientRect().height))
  );
  console.log(`  Item heights:`, itemHeights);
  if (itemHeights.some(h => h < 30)) {
    issue('low', 'palette', `Some palette items are too short: ${itemHeights.filter(h => h < 30).join(', ')}px`);
  }

  await p3.screenshot({ path: 'tests/browser-qa/screenshots/diag-palette.png', fullPage: false });
  await p3.keyboard.press('Escape');
  await c3.close();

  // ── Sidebar Collapse Behavior ────────────────────────────────
  console.log('\n━━━ Sidebar Collapse ━━━');
  const c4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(c4);
  const p4 = await c4.newPage();
  await p4.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p4.waitForTimeout(2000);

  // Before collapse: check text visibility
  const navTextBefore = await p4.$$eval('aside nav button span', els =>
    els.map(el => ({
      visible: el.offsetWidth > 0,
      text: el.textContent?.substring(0, 20),
      opacity: getComputedStyle(el).opacity,
    }))
  );
  console.log(`  Nav text before collapse: ${navTextBefore.filter(t => t.visible).length} visible`);

  // Collapse
  const collapseBtn = await p4.$('aside > div:last-child button');
  await collapseBtn.click();
  await p4.waitForTimeout(400);

  // After collapse: check icon visibility, text hidden
  const navTextAfter = await p4.$$eval('aside nav button', els =>
    els.map(el => ({
      width: Math.round(el.getBoundingClientRect().width),
      hasText: el.textContent?.trim().length > 0,
      title: el.getAttribute('title'),
    }))
  );
  console.log(`  Nav after collapse:`, JSON.stringify(navTextAfter.slice(0, 3)));

  // Check collapsed sidebar has tooltips
  const hasTitles = navTextAfter.every(n => n.title && n.title.length > 0);
  if (!hasTitles) {
    issue('medium', 'sidebar', 'Collapsed sidebar buttons missing tooltip titles');
  }

  await p4.screenshot({ path: 'tests/browser-qa/screenshots/diag-collapsed.png' });

  // Expand back
  const expandBtn = await p4.$('aside > div:last-child button');
  await expandBtn.click();
  await p4.waitForTimeout(400);
  const wRestore = await p4.$eval('aside', el => Math.round(el.getBoundingClientRect().width));
  console.log(`  Restored width: ${wRestore}px`);
  if (wRestore < 200) issue('medium', 'sidebar', `Sidebar did not fully expand: ${wRestore}px`);

  await p4.close();

  // ── Responsive: 1280px ──────────────────────────────────────
  console.log('\n━━━ Responsive (1280px) ━━━');
  const c5 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupAuth(c5);
  const p5 = await c5.newPage();
  await p5.goto(OPS, { waitUntil: 'networkidle', timeout: 20000 });
  await p5.waitForTimeout(3000);

  // Check if action queue items are readable
  const actionItems = await p5.$$eval('main .space-y-2 > div', els =>
    els.slice(0, 3).map(el => ({
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
    }))
  );
  console.log(`  Action items at 1280:`, JSON.stringify(actionItems));

  // Check if horizontal scroll triggered
  const hasHScroll = await p5.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  if (hasHScroll) issue('high', 'responsive', 'Horizontal scroll at 1280px');

  // Check legend/key visibility
  const legendVisible = await p5.evaluate(() => {
    const legends = document.querySelectorAll('[class*="text-\\[10px\\]"]');
    return Array.from(legends).filter(el => el.offsetWidth > 0).length;
  });
  console.log(`  Fine text elements visible: ${legendVisible}`);

  await p5.screenshot({ path: 'tests/browser-qa/screenshots/diag-1280.png' });
  await c5.close();

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ISSUES FOUND: ${issues.length}`);
  console.log(`    High: ${issues.filter(i => i.severity === 'high').length}`);
  console.log(`    Medium: ${issues.filter(i => i.severity === 'medium').length}`);
  console.log(`    Low: ${issues.filter(i => i.severity === 'low').length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await browser.close();

  // Output JSON for programmatic fix
  const fs = await import('fs');
  fs.writeFileSync('tests/browser-qa/issues.json', JSON.stringify(issues, null, 2));
  console.log('\nIssues written to tests/browser-qa/issues.json');
}

run().catch(e => { console.error('Diagnostics error:', e); process.exit(1); });
