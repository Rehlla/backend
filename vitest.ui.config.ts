import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * §7b(ii) — the thin jsdom project.
 *
 * The node project (vitest.config.ts) tests pure domain logic; it must stay
 * fast and free of DOM fakes. This project exists for exactly one class of
 * test: hooks and context providers whose contracts live in browser
 * behaviour — request cancellation on unmount, storage reads, attribute
 * application. Deliberately excluded:
 *
 * - No `tests/setup.ts`: that file swaps the database singleton onto an
 *   in-memory adapter and installs fs traps — meaningless and slow in a
 *   browser environment.
 * - The i18n registry IS seeded (tests/i18nSeed.ts): LanguageContext now
 *   resolves t() through the per-language registry installed at app boot by
 *   main.tsx, which no test runs.
 * - No JSX snapshot tests of large screens: with the MyTrip refactor and the
 *   i18n codemod moving markup and strings, snapshots would be churn.
 */
export default defineConfig({
  // The design primitives in src/components/ui import '@/lib/cn'. Same
  // subpath aliases as vite.config.ts (specific before bare '@'), so a test
  // can render a component built from them.
  resolve: {
    alias: {
      '@/lib': path.resolve(__dirname, 'src', 'lib'),
      '@/components': path.resolve(__dirname, 'src', 'components'),
      // LanguageContext imports '@/services/api' (dictionary sync); without
      // this entry every suite that renders a component reached from it
      // failed at import-analysis.
      '@/services': path.resolve(__dirname, 'src', 'services'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/ui/**/*.test.tsx'],
    setupFiles: ['tests/i18nSeed.ts'],
    testTimeout: 30_000,
    reporters: 'verbose'
  }
});
