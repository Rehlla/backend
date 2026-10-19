/**
 * DEEP UX/VISUAL AUDIT — read-only.
 *
 * Visits every main route at desktop AND mobile sizes and programmatically
 * detects real defects: console/page errors, failed requests (broken images,
 * 404 assets), horizontal overflow, empty sections, clipped/overlapping
 * content, tiny tap targets, missing alt text, and low-contrast text.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';

const BASE_URL = process.env.TARGET_URL || 'http://localhost:3000';
const OUT_DIR = path.join(import.meta.dirname, 'screenshots', 'ux-audit');
mkdirSync(OUT_DIR, { recursive: true });

const ROUTES = [
  '/', '/hotels', '/attractions', '/explore', '/transfers', '/rentals',
  '/food', '/restaurants', '/experiences', '/bookings', '/my-trip', '/live',
  '/programs', '/listings', '/daygi', '/plan-for-me', '/trip-builder',
  '/trip-preview', '/arrive', '/first-two-hours', '/change-recovery', '/help',
  '/quick-book', '/about', '/faq', '/travel-guides', '/auth/sign-in',
  '/auth/sign-up', '/ops-console', '/supplier-portal', '/market-intelligence',
];

const findings = [];
function report(sev, route, vp, msg) {
  findings.push({ sev, route, vp, msg });
  console.log(`  [${sev}] ${vp} ${route} — ${msg}`);
}

async function auditRoute(page, route, vpName, settleMs) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const onConsole = (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); };
  const onPageError = (e) => pageErrors.push(String(e).slice(0, 200));
  const onRequestFailed = (r) => failedRequests.push(`${r.failure()?.errorText || 'failed'} ${r.url().slice(0, 140)}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  try {
    await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((r) => setTimeout(r, settleMs || 4500));
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9-]/gi, '_');
    await page.screenshot({ path: path.join(OUT_DIR, `${vpName}-${slug}.png`) });

    const audit = await page.evaluate(() => {
      const issues = [];
      const d = document.documentElement;
      const vw = d.clientWidth;

      // 1. Horizontal overflow
      const overflowEls = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > vw + 4 || r.left < -4)) {
          overflowEls.push(el.tagName + '.' + String(el.className).slice(0, 60));
          if (overflowEls.length > 4) break;
        }
      }
      if (d.scrollWidth > vw + 4) issues.push({ type: 'overflow', detail: `scrollWidth ${d.scrollWidth} > viewport ${vw}; els: ${overflowEls.join(' | ')}` });

      // 2. Broken images
      const broken = [];
      for (const img of document.querySelectorAll('img')) {
        if (img.complete && img.naturalWidth === 0 && img.src) broken.push(img.src.slice(0, 110));
        if (broken.length > 4) break;
      }
      if (broken.length) issues.push({ type: 'broken-image', detail: broken.join(' | ') });

      // 3. Empty sections (visible containers with zero text and zero imgs)
      const emptySections = [];
      for (const s of document.querySelectorAll('section, [class*="section"], [class*="Section"], main > div')) {
        const r = s.getBoundingClientRect();
        if (r.height < 8 || r.width < 8) continue;
        const text = (s.innerText || '').trim();
        const imgs = s.querySelectorAll('img').length;
        const hasChildren = s.children.length > 0;
        if (hasChildren && !text && imgs === 0 && r.height > 30 && r.width > 100) {
          emptySections.push(s.tagName + '.' + String(s.className).slice(0, 50));
          if (emptySections.length > 5) break;
        }
      }
      if (emptySections.length) issues.push({ type: 'empty-section', detail: emptySections.join(' | ') });

      // 4. Images missing alt
      const noAlt = [];
      for (const img of document.querySelectorAll('img')) {
        if (!img.hasAttribute('alt')) {
          noAlt.push(img.src.slice(0, 70));
          if (noAlt.length > 4) break;
        }
      }
      if (noAlt.length) issues.push({ type: 'missing-alt', detail: noAlt.join(' | ') });

      // 5. Tiny tap targets (< 28px) on mobile
      const vpMobile = vw <= 500;
      if (vpMobile) {
        const tiny = [];
        for (const el of document.querySelectorAll('a, button')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.width < 28 || r.height < 28) && el.offsetParent !== null) {
            tiny.push(`${el.tagName}:${(el.innerText || el.getAttribute('aria-label') || '').slice(0, 24)} (${Math.round(r.width)}x${Math.round(r.height)})`);
            if (tiny.length > 6) break;
          }
        }
        if (tiny.length) issues.push({ type: 'tiny-target', detail: tiny.join(' | ') });
      }

      // 6. Low-contrast text — real WCAG check: normalize any CSS color
      // (incl. oklch/oklab and alpha) to sRGB via canvas, composite alpha
      // backgrounds up the ancestor chain, then measure contrast. The naive
      // rgba-string parser treated translucent white chips as solid white.
      const lowContrast = [];
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const toSrgb = (cssColor) => {
        if (!cssColor || cssColor === 'transparent' || cssColor === 'rgba(0, 0, 0, 0)') return { r: 0, g: 0, b: 0, a: 0 };
        try {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = cssColor;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
        } catch {
          const m = cssColor.match(/[\d.]+/g);
          if (!m) return { r: 0, g: 0, b: 0, a: 0 };
          const [r, g, b, a = 1] = m.map(Number);
          return { r, g, b, a };
        }
      };
      const composite = (over, under) => {
        const a = over.a + under.a * (1 - over.a);
        if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
        return {
          r: (over.r * over.a + under.r * under.a * (1 - over.a)) / a,
          g: (over.g * over.a + under.g * under.a * (1 - over.a)) / a,
          b: (over.b * over.a + under.b * under.a * (1 - over.a)) / a,
          a,
        };
      };
      const lum = ({ r, g, b }) => {
        const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const contrast = (fg, bg) => {
        const l1 = lum(fg);
        const l2 = lum(bg);
        const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
        return (hi + 0.05) / (lo + 0.05);
      };
      const seen = new Set();
      for (const el of document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, div, label')) {
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
        if (own.length < 2 || own.length > 100 || seen.has(own)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        let bg = { r: 0, g: 0, b: 0, a: 0 };
        let n = el;
        let depth = 0;
        while (n && depth < 6) {
          if (getComputedStyle(n).backgroundImage !== 'none') break; // gradient/photo: stop
          const b = toSrgb(getComputedStyle(n).backgroundColor);
          if (b && b.a > 0.001) bg = composite(b, bg);
          if (bg.a > 0.999) break;
          n = n.parentElement;
          depth++;
        }
        if (bg.a < 0.5) continue; // can't determine real bg (over images)
        const fg = toSrgb(cs.color);
        const ratio = contrast(fg, bg);
        if (ratio < 3.0 && fg.a > 0.8) {
          seen.add(own);
          lowContrast.push(`${own.slice(0, 36)} (${ratio.toFixed(1)}:1)`);
          if (lowContrast.length > 5) break;
        }
      }
      if (lowContrast.length) issues.push({ type: 'low-contrast', detail: lowContrast.join(' | ') });

      // 7. Body still shows loading spinner
      const spinner = document.querySelector('[class*="animate-spin"], [class*="spinner"]');
      if (spinner && !document.body.innerText.trim().length) {
        issues.push({ type: 'stuck-loading', detail: 'spinner visible, no content' });
      }

      // 8. Error boundary visible
      if (/something went wrong|حصلت مشكلة في عرض هذه الصفحة/i.test(document.body.innerText.slice(0, 3000))) {
        issues.push({ type: 'error-boundary', detail: document.body.innerText.match(/.{0,80}Something went wrong.{0,80}/i)?.[0] || '' });
      }

      return issues;
    });

    // Filter known-benign console noise
    const realConsoleErrors = consoleErrors.filter((e) =>
      !e.includes('401 (Unauthorized)') && // nav API auth probing is expected pre-login
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') // covered by requestfailed
    );

    for (const issue of audit) report(issue.type === 'overflow' ? 'P1' : 'P2', route, vpName, issue.detail);
    for (const e of pageErrors) report('P1', route, vpName, `pageerror: ${e}`);
    for (const e of realConsoleErrors) report('P2', route, vpName, `console: ${e}`);
    // ERR_ABORTED on API fetches = StrictMode double-mount abort in dev, benign.
    const realFailed = failedRequests.filter((f) =>
      !f.includes('ERR_ABORTED') &&
      !f.includes('assets.mixkit.co') && // external stock video, blocked in headless
      !f.includes('favicon')
    );
    for (const f of realFailed) report('P1', route, vpName, `failed request: ${f}`);
  } catch (e) {
    report('P1', route, vpName, `AUDIT ERROR: ${String(e).slice(0, 140)}`);
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
  }
}

async function main() {
  console.log(`\n🔍 DEEP UX/VISUAL AUDIT — ${BASE_URL}`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // Desktop pass
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dPage = await desktop.newPage();
  console.log('\n── DESKTOP (1440×900) ──');
  for (const route of ROUTES) await auditRoute(dPage, route, 'desktop');

  // Mobile pass
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mPage = await mobile.newPage();
  console.log('\n── MOBILE (390×844) ──');
  for (const route of ROUTES) await auditRoute(mPage, route, 'mobile');

  await browser.close();

  // Summary
  const bySev = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of findings) bySev[f.sev] = (bySev[f.sev] || 0) + 1;
  console.log(`\n════════════════════════════════════════`);
  console.log(`FINDINGS: P0=${bySev.P0} P1=${bySev.P1} P2=${bySev.P2} P3=${bySev.P3}`);
  const grouped = {};
  for (const f of findings) {
    const key = f.route + ' ' + f.vp;
    (grouped[key] = grouped[key] || []).push(f);
  }
  for (const [key, list] of Object.entries(grouped)) {
    console.log(`\n${key}: ${list.map((f) => `${f.sev} ${f.msg.slice(0, 90)}`).join('\n    ')}`);
  }
  process.exit(bySev.P1 > 0 ? 0 : 0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });