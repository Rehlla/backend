/**
 * Home Page Browser QA — captures screenshots across viewports and themes,
 * scans for visual defects in the sections we changed.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/browser-qa/screenshots/home-page', { recursive: true });

const BASE = 'http://localhost:3000';

async function setupAuth(ctx) {
  const email = `homeqa-${Date.now()}@dahab.travel`;
  const res = await ctx.request.post(`${BASE}/api/auth/register`, {
    data: { name: 'Home QA', email, password: 'QA2026!', role: 'Traveler' }
  });
  const h = res.headers()['set-cookie'];
  if (h) {
    const m = h.match(/dahab_auth_token=([^;]+)/);
    if (m) await ctx.addCookies([{ name: 'dahab_auth_token', value: m[1], domain: 'localhost', path: '/' }]);
  }
  return email;
}

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const THEMES = [
  { id: 'charcoal-minimal', name: 'Charcoal' },
  { id: 'deep-reef', name: 'Emerald' },
  { id: 'editorial-sand', name: 'Sand' },
  { id: 'lagoon-breeze', name: 'Lagoon' },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const issues = [];

  function issue(severity, area, desc, viewport) {
    issues.push({ severity, area, desc, viewport });
    const icon = severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🔵';
    console.log(`  ${icon} [${area}] ${desc}${viewport ? ` (${viewport})` : ''}`);
  }

  // ── 1. Desktop screenshots across themes ──────────────────
  console.log('\n━━━ Desktop (1440px) — Theme Sweep ━━━');
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setupAuth(ctx);
    const page = await ctx.newPage();

    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Set theme
    await page.evaluate((tid) => {
      document.documentElement.setAttribute('data-theme-id', tid);
      document.body.setAttribute('data-theme-id', tid);
    }, theme.id);
    await page.waitForTimeout(500);

    // Full page screenshot
    await page.screenshot({
      path: `tests/browser-qa/screenshots/home-page/1440px-${theme.id}-full.png`,
      fullPage: true
    });
    console.log(`  ✅ ${theme.name} — full page captured`);

    // Hero section
    const hero = await page.$('#cinematic-hero-cockpit');
    if (hero) {
      await hero.screenshot({ path: `tests/browser-qa/screenshots/home-page/1440px-${theme.id}-hero.png` });
      console.log(`  ✅ ${theme.name} — hero captured`);
    }

    // Check hero text contrast
    const heroH1 = await page.$('#cinematic-hero-cockpit h1');
    if (heroH1) {
      const h1Style = await heroH1.evaluate(el => {
        const s = getComputedStyle(el);
        return { color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight };
      });
      console.log(`  📐 Hero h1: color=${h1Style.color} size=${h1Style.fontSize} weight=${h1Style.fontWeight}`);
    }

    // Trip Entry section
    const tripEntry = await page.$('#how-do-you-want-to-experience-dahab');
    if (tripEntry) {
      await tripEntry.screenshot({ path: `tests/browser-qa/screenshots/home-page/1440px-${theme.id}-trip-entry.png` });
      console.log(`  ✅ ${theme.name} — trip entry captured`);
    }

    // Check pathway cards have proper backgrounds
    const pathwayCards = await page.$$('#pathway-build-myself, #pathway-ready-trips, #pathway-plan-it-for-me');
    for (const card of pathwayCards) {
      const cardBg = await card.evaluate(el => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, border: s.borderColor, shadow: s.boxShadow?.substring(0, 60) };
      });
      console.log(`  📐 Card bg=${cardBg.bg} border=${cardBg.border}`);
    }

    // Quick Services Grid
    const quickGrid = await page.$('#quick-trip-services-grid');
    if (quickGrid) {
      await quickGrid.screenshot({ path: `tests/browser-qa/screenshots/home-page/1440px-${theme.id}-quick-services.png` });
      console.log(`  ✅ ${theme.name} — quick services captured`);
    }

    // Footer
    const footer = await page.$('footer[role="contentinfo"]');
    if (footer) {
      await footer.screenshot({ path: `tests/browser-qa/screenshots/home-page/1440px-${theme.id}-footer.png` });
      console.log(`  ✅ ${theme.name} — footer captured`);
    } else {
      issue('medium', 'footer', 'Footer with role=contentinfo not found', '1440px');
    }

    // Check for overflow issues
    const overflowIssues = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const viewWidth = window.innerWidth;
      return { docWidth, viewWidth, hasOverflow: docWidth > viewWidth + 2 };
    });
    if (overflowIssues.hasOverflow) {
      issue('high', 'overflow', `Horizontal overflow: doc=${overflowIssues.docWidth}px view=${overflowIssues.viewWidth}px`, '1440px');
    }

    // Check section nav
    const sectionNav = await page.$('nav[aria-label]');
    if (sectionNav) {
      const navVisible = await sectionNav.evaluate(el => {
        const s = getComputedStyle(el);
        return { opacity: s.opacity, display: s.display };
      });
      console.log(`  📐 Section nav: opacity=${navVisible.opacity} display=${navVisible.display}`);
    }

    await ctx.close();
  }

  // ── 2. Responsive screenshots (Charcoal theme) ──────────
  console.log('\n━━━ Responsive Sweep (Charcoal) ━━━');
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await setupAuth(ctx);
    const page = await ctx.newPage();

    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Set charcoal theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme-id', 'charcoal-minimal');
      document.body.setAttribute('data-theme-id', 'charcoal-minimal');
    });
    await page.waitForTimeout(500);

    // Full page
    await page.screenshot({
      path: `tests/browser-qa/screenshots/home-page/${vp.name}-full.png`,
      fullPage: true
    });
    console.log(`  ✅ ${vp.name} — full page`);

    // Hero viewport only
    const hero = await page.$('#cinematic-hero-cockpit');
    if (hero) {
      await hero.screenshot({ path: `tests/browser-qa/screenshots/home-page/${vp.name}-hero.png` });
    }

    // Check for text truncation / overflow
    const textOverflow = await page.evaluate(() => {
      const problems = [];
      document.querySelectorAll('h1, h2, h3, p').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 5) {
          problems.push({ tag: el.tagName, text: el.textContent?.substring(0, 40), right: Math.round(r.right) });
        }
      });
      return problems;
    });
    if (textOverflow.length > 0) {
      for (const p of textOverflow) {
        issue('high', 'overflow', `Text overflow: <${p.tag}> "${p.text}..." extends to ${p.right}px`, vp.name);
      }
    }

    // Check horizontal overflow
    const overflow = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      viewWidth: window.innerWidth,
    }));
    if (overflow.docWidth > overflow.viewWidth + 2) {
      issue('high', 'overflow', `Horizontal scroll: doc=${overflow.docWidth}px view=${overflow.viewWidth}px`, vp.name);
    }

    // Check that pathway cards stack on mobile
    if (vp.width < 768) {
      const cardLayout = await page.evaluate(() => {
        const grid = document.querySelector('#trip-entry-doorways-grid');
        if (!grid) return null;
        const s = getComputedStyle(grid);
        return { display: s.display, gridTemplateColumns: s.gridTemplateColumns };
      });
      if (cardLayout) {
        console.log(`  📐 Mobile card grid: ${cardLayout.gridTemplateColumns}`);
        if (cardLayout.gridTemplateColumns !== 'none' && cardLayout.gridTemplateColumns.includes(' ')) {
          issue('medium', 'layout', 'Pathway cards not stacking on mobile', vp.name);
        }
      }
    }

    // Check that CTA buttons are tappable (min 44px)
    const ctaButtons = await page.$$eval('#hero-start-trip-cta, #hero-browse-experiences-cta', els =>
      els.map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id, height: Math.round(r.height), width: Math.round(r.width) };
      })
    );
    for (const btn of ctaButtons) {
      if (btn.height < 44) {
        issue('medium', 'a11y', `CTA "${btn.id}" height ${btn.height}px < 44px minimum`, vp.name);
      }
    }

    await ctx.close();
  }

  // ── 3. Scroll & Interaction Checks ──────────────────────
  console.log('\n━━━ Scroll & Interaction (1440px Charcoal) ━━━');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupAuth(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme-id', 'charcoal-minimal');
    document.body.setAttribute('data-theme-id', 'charcoal-minimal');
  });
  await page.waitForTimeout(500);

  // Scroll to each major section and screenshot
  const sections = [
    { id: 'cinematic-hero-cockpit', name: 'hero' },
    { id: 'how-do-you-want-to-experience-dahab', name: 'trip-entry' },
    { id: 'quick-trip-services-grid', name: 'quick-services' },
  ];

  for (const sec of sections) {
    const el = await page.$(`#${sec.id}`);
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await el.screenshot({ path: `tests/browser-qa/screenshots/home-page/scrolled-${sec.name}.png` });
      console.log(`  ✅ Scrolled to ${sec.name}`);
    }
  }

  // Check scroll-to-section nav works
  const navButtons = await page.$$('nav[aria-label] button[data-section]');
  console.log(`  📐 Section nav buttons: ${navButtons.length}`);
  if (navButtons.length > 0) {
    // Click the second nav button
    if (navButtons.length > 1) {
      await navButtons[1].click();
      await page.waitForTimeout(800);
      const scrollY = await page.evaluate(() => window.scrollY);
      console.log(`  📐 After nav click, scrollY=${scrollY}`);
      if (scrollY < 100) {
        issue('medium', 'nav', 'Section nav click did not scroll page', '1440px');
      }
    }
  }

  // Check footer is visible at bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const footerVisible = await page.evaluate(() => {
    const f = document.querySelector('footer[role="contentinfo"]');
    if (!f) return false;
    const r = f.getBoundingClientRect();
    return r.top < window.innerHeight;
  });
  if (!footerVisible) {
    issue('medium', 'footer', 'Footer not visible after scrolling to bottom', '1440px');
  } else {
    console.log('  ✅ Footer visible at bottom');
  }

  // ── Summary ──────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total issues found: ${issues.length}`);
  const high = issues.filter(i => i.severity === 'high');
  const med = issues.filter(i => i.severity === 'medium');
  const low = issues.filter(i => i.severity === 'low');
  console.log(`  🔴 High: ${high.length}  🟡 Medium: ${med.length}  🔵 Low: ${low.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (high.length > 0) {
    console.log('High severity issues:');
    for (const i of high) console.log(`  🔴 [${i.area}] ${i.desc} (${i.viewport})`);
  }

  await browser.close();
}

run().catch(err => {
  console.error('QA script failed:', err.message);
  process.exit(1);
});
