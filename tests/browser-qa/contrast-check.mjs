/**
 * Real contrast check: composites alpha backgrounds up the ancestor chain and
 * reports genuine WCAG failures (the naive audit checker treated translucent
 * white chips as solid white — false positives).
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PAGES = ['/live', '/programs', '/listings', '/food', '/first-two-hours', '/change-recovery', '/auth/sign-in', '/auth/sign-up', '/hotels', '/attractions', '/restaurants'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });

function parseColor(c) {
  const m = c.match(/[\d.]+/g);
  if (!m) return null;
  const [r, g, b, a = 1] = m.map(Number);
  return { r, g, b, a };
}

function composite(over, under) {
  const a = over.a + under.a * (1 - over.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (over.r * over.a + under.r * under.a * (1 - over.a)) / a,
    g: (over.g * over.a + under.g * under.a * (1 - over.a)) / a,
    b: (over.b * over.a + under.b * under.a * (1 - over.a)) / a,
    a,
  };
}

function luminance({ r, g, b }) {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

for (const route of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 4500));

  const results = await page.evaluate(() => {
    // Normalize ANY CSS color (incl. oklch/oklab) to sRGB via canvas.
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
    const luminance = ({ r, g, b }) => {
      const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const contrastRatio = (fg, bg) => {
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (hi + 0.05) / (lo + 0.05);
    };

    const found = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, div, label')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (own.length < 2 || own.length > 100 || seen.has(own)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;

      // composite background up the chain (skip elements with gradients —
      // backgroundColor is transparent there, so we'd measure against the
      // parent and invent a failure)
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
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.0 && fg.a > 0.8) {
        seen.add(own);
        found.push({ text: own.slice(0, 45), ratio: ratio.toFixed(2), fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})` });
      }
    }
    return found.slice(0, 12);
  });

  if (results.length) {
    console.log(`\n❌ /${route.replace(/^\//, '')}`);
    for (const x of results) console.log(`   ${x.ratio}:1  "${x.text}"  fg=${x.fg} bg=${x.bg}`);
  } else {
    console.log(`✅ /${route.replace(/^\//, '')} — no genuine contrast failures`);
  }
  await page.close();
}
await browser.close();