import fs from 'fs';
import path from 'path';

const WANT = 'nuweiba_hotels.json';
function scan(dir, depth) {
  if (depth > 3) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    const ta = path.join(full, 'data', 'tripadvisor');
    try {
      if (fs.existsSync(ta)) {
        const files = fs.readdirSync(ta).filter((f) => f.endsWith('.json'));
        const sizes = files.map((f) => {
          const st = fs.statSync(path.join(ta, f));
          return `${f}:${Math.round(st.size / 1024)}KB`;
        });
        console.log(`\nFOUND data/tripadvisor @ ${full}`);
        console.log('  ' + sizes.join('\n  '));
      }
    } catch { /* skip */ }
    if (/dahab|Travel/i.test(e.name)) scan(full, depth + 1);
  }
}
scan('D:\\', 0);
