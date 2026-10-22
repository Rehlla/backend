import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Specific subpath aliases MUST precede bare '@': Vite matches alias
        // keys as ordered prefixes, so '@/lib/cn' would otherwise hit
        // '@' -> repo root and resolve to <root>/lib/cn (nonexistent).
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
    build: {
      rollupOptions: {
        output: {
          /**
           * Keep the heavy third-party libraries out of the critical path.
           *
           * Route-level React.lazy took the initial chunk from 3,239 kB to
           * 1,723 kB; what remains is largely vendor code that the homepage
           * does not need in order to paint. Firebase is only reached when
           * someone signs in with Google, and motion only where something
           * animates.
           *
           * The traveler this matters to is on a Sinai mobile network — the
           * same connectivity the api client's 8s timeout was written for.
           */
          manualChunks(id: string) {
            // Per-language dictionary chunks (see src/i18n/translator.ts).
            // Each is emitted standalone with a stable content hash, so
            // first paint downloads only the ACTIVE language's dictionary and
            // deploys that don't touch copy re-download neither. The dynamic
            // import in translator.ts (booted from main.tsx) is what puts the
            // right chunk before first render; these rules only stop Rollup
            // from folding the chunks into the importers that reference them.
            // The authoring catalog (src/i18n/translations.ts) is SERVER-ONLY:
            // the import-ban test (tests/domain/i18nDictionarySync.test.ts)
            // fails if client code ever imports it again, so no rule for it
            // here on purpose — a stray reference must not be masked.
            if (id.includes('/src/i18n/dictionaries/en')) return 'i18n-en';
            if (id.includes('/src/i18n/dictionaries/ar')) return 'i18n-ar';
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase';
            if (id.includes('@mediapipe')) return 'vendor-vision';
            if (id.includes('/three/') || id.includes('node_modules/three')) return 'vendor-orb';
            // NOTE: no 'intel-core' chunk on purpose. Core views stay in
            // per-route lazy chunks: the floating Core loads on every ops
            // section, and folding the full section into it would bloat that
            // path. (A previous revision listed such a branch here, but it
            // sat after the node_modules guard and never matched.)
            if (id.includes('motion') || id.includes('framer')) return 'vendor-motion';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            return undefined;
          }
        }
      },
      // The route chunks are already split; this stops the warning from firing
      // on the vendor bundles, which are cached across every navigation.
      chunkSizeWarningLimit: 650
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      //
      // When HMR is enabled, its WebSocket port is derived from PORT so that
      // concurrent dev servers (manual :3000, Playwright :3100, throwaway QA
      // ports) do not all collide on Vite's default 24678 with
      // "WebSocket server error: Port 24678 is already in use".
      // Override with HMR_PORT when running an unusual topology.
      //
      // When HMR is disabled, `ws: false` is the actual kill switch: in
      // middleware mode `hmr: false` alone still lets Vite bind a standalone
      // WebSocket server on 24678 (createWebSocketServer only early-returns
      // on `server.ws === false`), so concurrent servers still collide.
      ...(process.env.DISABLE_HMR !== 'true'
        ? { hmr: { port: Number(process.env.HMR_PORT) || (24678 + ((Number(process.env.PORT) || 3000) - 3000)) } }
        : { hmr: false, ws: false }),
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // The Flutter app (dahab-mobile/) and stray root scripts are not part of
      // the site; without this, any save or `flutter build` there reloads every
      // open page.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : { ignored: ['**/dahab-mobile/**', '**/tests/browser-qa/**', '**/data/**'] },
    },
  };
});
