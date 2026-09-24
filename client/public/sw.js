// PestControl Pro Service Worker - Version 5
const CACHE_NAME = 'pestcontrol-v5';

const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/tech-icon-192.png',
  '/tech-icon-512.png',
  '/favicon.svg'
];

// Service Worker Install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL).catch((err) => {
        console.warn('[SW] Shell cache prefetch:', err);
      });
    })
  );
});

// Service Worker Activate - Delete all old caches completely
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Handler - Only handle navigation requests for offline support.
// Let all static scripts, assets, and APIs pass directly to standard browser HTTP pipeline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  // Let all API and Vite hashed assets pass directly to browser without SW interception
  if (req.url.includes('/api/') || req.url.includes('/assets/')) {
    return;
  }

  // Handle SPA navigation requests
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return caches.match('/index.html');
        })
    );
    return;
  }
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
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes('one-pest.vercel.app') || client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
