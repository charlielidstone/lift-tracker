// Custom service worker (VitePWA `injectManifest` mode). Hand-written because we
// need a `push` event handler for REAL server-sent notifications — generateSW
// (the old mode) cannot add one. This file therefore has to reproduce, by hand,
// everything the old generateSW `workbox` config did for us automatically:
// precache + cleanup, immediate takeover, SPA navigation fallback, and the
// "never cache Supabase" rule. The push/notificationclick handlers are the new part.

import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// --- Lifecycle: a new SW takes over IMMEDIATELY (was workbox.skipWaiting +
// clientsClaim). An installed PWA is never fully closed, so without this the old
// cached bundle keeps serving and deploys appear not to land.
self.skipWaiting();
clientsClaim();

// --- Precache the app shell. `self.__WB_MANIFEST` is the injection point VitePWA
// fills at build time with the hashed asset list (globPatterns in vite.config).
precacheAndRoute(self.__WB_MANIFEST);
// Drop precaches from previous deploys so we don't accumulate stale assets.
cleanupOutdatedCaches();

// --- SPA fallback: serve index.html from precache for app routes so any route
// works offline — EXCEPT Supabase REST/auth paths (never served from cache).
const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/rest\//, /^\/auth\//],
  }),
);

// --- Never cache Supabase API/auth calls — the app's own outbox handles offline
// writes; caching these would serve stale data or hide errors.
registerRoute(({ url }) => url.hostname.endsWith('.supabase.co'), new NetworkOnly());

// --- PUSH: the OS wakes the SW with a server-sent message; draw the notification.
// The Edge Function sends a JSON payload; fall back to sane defaults if it's
// missing or unparseable so a bare push still shows something.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'Lift Tracker';
  const options = {
    body: data.body || 'Time to train. 💪',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'lift-reminder',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// --- CLICK: focus an already-open app window, otherwise open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
