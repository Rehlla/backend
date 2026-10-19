import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const src = readFileSync('src/shared/placeholderImagery.ts', 'utf8');
const files = execSync('git ls-files --cached --others --exclude-standard "src/**/*.tsx" "src/**/*.ts"', {
  encoding: 'utf8'
})
  .split('\n')
  .filter(Boolean)
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f) => existsSync(f))
  .filter((f) => !f.includes('placeholderImagery'));

const used = new Set<string>();
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/IMG_P[A-Za-z0-9_]+/g)) used.add(m[0]);
}
const missing = [...used].filter((n) => !src.includes(`export const ${n}`));
console.log(`used: ${used.size}, missing: ${missing.length}`);
console.log(missing.join('\n'));
