/**
 * One-off codemod that finishes the Tailwind polish sweep which this batch of
 * edits has been applying file-by-file across `src/components`. The sweep
 * exists because every pattern below was measured as a real defect (bundle
 * weight, paint cost, or a WCAG/design-rule violation) — see DESIGN.md's
 * sentence-case rule and the "two voices only" type rule.
 *
 * Replacements (exactly those observed in the sweep, nothing broader):
 *  1. `transition-all` → a scoped property list. Transitioning every
 *     property forces style recalculation on unrelated properties (and
 *     animates `all` incl. layout); only color/box/transform/opacity are
 *     ever animated here. `transition-colors` and `transition-shadow` are
 *     left alone — they are already scoped.
 *  2. `uppercase ` + ` tracking-wider` / `tracking-widest` removed.
 *     DESIGN.md: badges are sentence case, never all-caps; Arabic copy has
 *     no uppercase at all, so the class only damages the ar locale.
 *  3. Ghost font families stripped: `font-['Plus_Jakarta_Sans',sans-serif]`
 *     names a face that is not loaded anywhere (superseded by the Outfit +
 *     Alexandria two-voice stack); `font-['Outfit',sans-serif]` re-declares
 *     the body default on individual nodes.
 *
 * Run once: `npx tsx scripts/codemod-tailwind-sweep.ts`
 * BookingPaymentStep.tsx is out of scope (payment files are never touched —
 * remediation plan §1/§3 exclusion).
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const OUT_OF_SCOPE = new Set(['src/components/booking/BookingPaymentStep.tsx']);

const SCOPED_TRANSITION =
  'transition-[background-color,border-color,color,box-shadow,transform,opacity]';

const files = (
  execSync('git ls-files --cached --others --exclude-standard "src/**/*.tsx" "src/**/*.ts"', {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    // Untracked files appear relative-path-normalised; strip duplicates.
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f, i, all) => all.indexOf(f) === i)
    .filter((f) => !OUT_OF_SCOPE.has(f))
);

let touched = 0;
const counts = { transitionAll: 0, upper: 0, tracking: 0, ghostFonts: 0 };

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let after = before;

  const n1 = (after.match(/transition-all/g) || []).length;
  after = after.replace(/transition-all/g, SCOPED_TRANSITION);
  counts.transitionAll += n1;

  const n2 = (after.match(/uppercase /g) || []).length;
  after = after.replace(/uppercase /g, '');
  counts.upper += n2;

  const n3 = (after.match(/ tracking-wider| tracking-widest/g) || []).length;
  after = after.replace(/ tracking-wider| tracking-widest/g, '');
  counts.tracking += n3;

  // Ghost font families. Two spellings of the ghost face exist.
  const ghostPatterns = [
    / ?font-\['Plus_Jakarta_Sans',sans-serif\]/g,
    / ?font-\['Outfit',sans-serif\]/g,
  ];
  for (const p of ghostPatterns) {
    const n = (after.match(p) || []).length;
    if (n) {
      counts.ghostFonts += n;
      after = after.replace(p, '');
    }
  }

  if (after !== before) {
    writeFileSync(file, after);
    touched++;
    console.log(`  ${file}`);
  }
}

console.log(
  `\n${touched} file(s) updated — transition-all: ${counts.transitionAll}, ` +
    `uppercase: ${counts.upper}, tracking: ${counts.tracking}, ghost fonts: ${counts.ghostFonts}`
);
