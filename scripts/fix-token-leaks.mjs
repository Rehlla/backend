#!/usr/bin/env node
/**
 * Token-leak fixer: replaces hardcoded gold/dark hex values with CSS var()
 * mappings from the Dahab Luxury Re-Skin design system.
 * 
 * Conservative: only replaces the gold accent palette and its ink, which are
 * the primary token leaks. Light-theme overrides are left as-is for now.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const REPLACEMENTS = [
  // Gold palette → accent-primary / accent-secondary
  { from: /#C8933D/g, to: 'var(--accent-primary)', label: 'gold-primary' },
  { from: /#c8933d/g, to: 'var(--accent-primary)', label: 'gold-primary-lower' },
  { from: /#C9A24B/g, to: 'var(--accent-secondary)', label: 'gold-secondary' },
  { from: /#c9a24b/g, to: 'var(--accent-secondary)', label: 'gold-secondary-lower' },
  { from: /#8F6413/g, to: 'var(--accent-secondary)', label: 'gold-dark' },
  { from: /#8f6413/g, to: 'var(--accent-secondary)', label: 'gold-dark-lower' },
  
  // Ink / dark text on gold → accent-primary-ink
  { from: /#1A1206/g, to: 'var(--accent-primary-ink)', label: 'gold-ink' },
  { from: /#1A1408/g, to: 'var(--accent-primary-ink)', label: 'gold-ink-alt' },
];

// Get files with token leaks (only gold palette)
const files = execSync('grep -rln "#C8933D\\|#C9A24B\\|#8F6413\\|#1A1206\\|#1A1408" src/components --include="*.tsx"', { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

let totalFixed = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let fileFixed = 0;
  
  for (const { from, to, label } of REPLACEMENTS) {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      fileFixed += matches.length;
    }
  }
  
  if (fileFixed > 0) {
    writeFileSync(file, content);
    console.log(`${file}: ${fileFixed} replacements`);
    totalFixed += fileFixed;
  }
}

console.log(`\nTotal: ${totalFixed} gold token leaks fixed across ${files.length} files`);