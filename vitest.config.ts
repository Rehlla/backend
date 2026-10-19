import { defineConfig } from 'vitest/config';
import path from 'path';

console.log('VITEST CONFIG LOADED (JS)', __dirname);

export default defineConfig({
  // Same subpath aliases as vite.config.ts (specific before bare '@'), so a
  // node test can import src/ modules that use '@/...' specifiers. This must
  // sit at the TOP LEVEL: `resolve` is a Vite option, and nesting it under
  // `test` silently disables every alias — LanguageContext's '@/services/api'
  // then resolved as a bare package and failed with ERR_MODULE_NOT_FOUND.
  resolve: {
    alias: {
      '@/components': path.resolve(__dirname, 'src', 'components'),
      '@/lib': path.resolve(__dirname, 'src', 'lib'),
      '@/i18n': path.resolve(__dirname, 'src', 'i18n'),
      '@/pages': path.resolve(__dirname, 'src', 'pages'),
      '@/context': path.resolve(__dirname, 'src', 'context'),
      '@/data': path.resolve(__dirname, 'src', 'data'),
      '@/design': path.resolve(__dirname, 'src', 'design'),
      '@/styles': path.resolve(__dirname, 'src', 'styles'),
      '@/hooks': path.resolve(__dirname, 'src', 'hooks'),
      '@/services': path.resolve(__dirname, 'src', 'services'),
      '@/shared': path.resolve(__dirname, 'src', 'shared'),
      '@/types': path.resolve(__dirname, 'src', 'types'),
      '@/utils': path.resolve(__dirname, 'src', 'utils'),
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    // Only our own tests. server/test/* are the legacy self-certification
    // scripts, which are run manually via tsx and assert shape rather than
    // behaviour - they are deliberately not part of this suite.
    include: ['tests/**/*.test.ts'],
    // Swaps the Database singleton onto an in-memory adapter so the suite never
    // reads or writes data/dahab_db.json.
    setupFiles: ['tests/setup.ts', 'tests/i18nSeed.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The suite touches the shared JSON database singleton, so files must not
    // run concurrently against each other.
    fileParallelism: false,
    reporters: 'verbose',
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      thresholds: { lines: 60, branches: 50 }
    }
  }
});
