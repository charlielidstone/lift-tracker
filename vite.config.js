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
      workbox: {
        // Precache the app shell (JS/CSS/HTML/icons) so a cold start works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA fallback so any route serves index.html from cache when offline.
        navigateFallback: '/index.html',
        // NEVER cache Supabase API/auth calls — the app's own outbox handles
        // offline writes; caching them would serve stale data or shadow errors.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // Enable the SW in `vite dev` so we can test offline behavior locally.
        enabled: true,
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
