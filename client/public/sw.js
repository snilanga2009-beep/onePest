// PestControl Pro Service Worker - Version 4
const CACHE_NAME = 'pestcontrol-v4';

const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/tech-icon-192.png',
  '/tech-icon-512.png',
  '/tech-icon.svg',
  '/favicon.svg'
];

// Service Worker Install - Skip waiting immediately to activate latest version
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL).catch((err) => {
        console.warn('[SW] Cache prefetch note:', err);
      });
    })
  );
});

// Service Worker Activate - Delete all old versions and claim all open clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Allow client app to send messages (e.g. SKIP_WAITING)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Handler - Bulletproof Network-First for Navigation, Stale-While-Revalidate for Assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  // Let API requests pass directly to network (IndexedDB handles offline API queue)
  if (req.url.includes('/api/')) {
    return;
  }

  // 1. Navigation requests (Opening the app, clicking icon, opening /tech, /, etc.)
  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback
          const cached = await caches.match(req);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 2. Static Assets (JS scripts, CSS stylesheets, images, fonts)
  const isStaticAsset = req.url.includes('/assets/') ||
    req.destination === 'script' ||
    req.destination === 'style' ||
    req.destination === 'image' ||
    req.destination === 'font';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        }).catch(() => null);

        // Return cached asset immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Fallback for all other requests
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// ==================================================
// REAL WEB PUSH & FIREBASE CLOUD MESSAGING (FCM) HANDLER
// ==================================================

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'PestControl Pro', body: event.data.text() };
    }
  }

  const notification = data.notification || {};
  const customData = data.data || data;

  const title = notification.title || customData.title || data.title || 'PestControl Pro Assignment';
  const body = notification.body || customData.body || data.body || 'You have an operational update.';
  const jobId = customData.jobId || data.jobId;
  const targetUrl = customData.url || (jobId ? `/tech?job=${jobId}` : '/');

  const options = {
    body,
    icon: customData.icon || '/tech-icon-192.png',
    badge: customData.badge || '/tech-icon-192.png',
    tag: customData.tag || (jobId ? `job-${jobId}` : 'pestcontrol-job'),
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: targetUrl,
      jobId,
      type: customData.type || 'OPERATIONAL'
    },
    actions: [
      { action: 'open', title: 'Open Job' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Handler: Focus existing PWA window or open new
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes('one-pest.vercel.app') || client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // If no window is currently open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
