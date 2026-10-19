// Builds the self-contained concept page: inlines every {{IMG:path}} (relative
// to public/images) as a resized WebP data URI so it can be shared as one file.
// Usage: node docs/premium-plan/concept/build.mjs <out.html>
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const sharp = createRequire(path.join(root, 'package.json'))('sharp');
const out = process.argv[2] || path.join(here, 'concept.html');

let html = fs.readFileSync(path.join(here, 'concept.src.html'), 'utf8');
const refs = [...new Set([...html.matchAll(/\{\{IMG:([^}]+)\}\}/g)].map(m => m[1]))];
for (const ref of refs) {
  const buf = await sharp(path.join(root, 'public/images', ref))
    .resize({ width: 720, withoutEnlargement: true })
    .webp({ quality: 62 })
    .toBuffer();
  html = html.replaceAll(`{{IMG:${ref}}}`, `data:image/webp;base64,${buf.toString('base64')}`);
  console.log(`${ref}  ${(buf.length / 1024).toFixed(0)} kB`);
}
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} kB)`);
