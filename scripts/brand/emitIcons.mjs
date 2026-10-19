// Renders the REHLA app icons and favicon from the mark (src/components/brand/RehlaLogo.tsx).
// Usage: node scripts/brand/emitIcons.mjs   (writes public/favicon.svg and public/icons/*.png)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sharp = createRequire(path.join(root, 'package.json'))('sharp');

const MARK = (stroke, sun) => `
  <path d="M7 45h7l10-15.5c1.2-1.8 3.8-1.8 5 0L36 40c1.6 2.4 4.6 2.6 6.4.4 2.9-3.6 7-3.6 9.9 0 1.2 1.5 2.9 2.2 4.7 2.2" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="43" cy="19" r="5.5" fill="${sun}"/>`;

// Abyss ground, lagoon line, coral sun: the Dahab default.
const icon = ({ inset = 0, radius = 14 }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#13222C"/><stop offset="1" stop-color="#0B151C"/></linearGradient></defs>
  <rect width="64" height="64" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${32 - 32 * (1 - inset)} ${32 - 32 * (1 - inset)}) scale(${1 - inset})">${MARK('#3CC2BC', '#F08A6C')}</g>
</svg>`;

fs.writeFileSync(path.join(root, 'public/favicon.svg'), icon({ inset: 0.08, radius: 14 }));
const out = path.join(root, 'public/icons');
fs.mkdirSync(out, { recursive: true });
const jobs = [
  ['icon-192.png', 192, icon({ inset: 0.1, radius: 14 })],
  ['icon-512.png', 512, icon({ inset: 0.1, radius: 14 })],
  // Maskable: full-bleed square, mark inside the 80% safe zone.
  ['icon-maskable-512.png', 512, icon({ inset: 0.28, radius: 0 })],
  // iOS applies its own corner mask.
  ['apple-touch-icon.png', 180, icon({ inset: 0.16, radius: 0 })],
];
for (const [name, size, svg] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(out, name));
  console.log('wrote public/icons/' + name);
}
