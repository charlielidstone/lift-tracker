import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest: we ship our OWN service worker (src/sw.js) because we need
      // a custom `push` handler for real notifications. VitePWA just injects the
      // precache manifest into it. (Was the default generateSW, which can't add a
      // push handler — src/sw.js reproduces the old workbox behavior by hand.)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // Auto-update: a new deploy silently installs and takes over on next load.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lift Tracker',
        short_name: 'Lifts',
        description: 'Fast weightlifting logger — works offline.',
        theme_color: '#7c3aed',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Precache the app shell (JS/CSS/HTML/icons) so a cold start works offline.
        // This list is injected into src/sw.js at `self.__WB_MANIFEST`. The runtime
        // behaviors (skipWaiting, clientsClaim, nav fallback, Supabase NetworkOnly)
        // now live in src/sw.js itself — generateSW's `workbox` options don't apply.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: {
        // Service worker DISABLED in `vite dev`: the dev SW is flaky — it 404s on a
        // missing dev-dist/sw.js after a `vite build` runs alongside the dev server,
        // and serves stale modules. Test PWA/offline behavior on the deployed build
        // instead. Production SW (dist/sw.js) is unaffected.
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    // Allow Cloudflare quick-tunnel hosts so the phone preview works.
    allowedHosts: ['.trycloudflare.com'],
  },
});
