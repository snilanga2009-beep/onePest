const CACHE_NAME = 'pestcontrol-tech-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/tech',
  '/manifest.json',
  '/tech-icon-192.png',
  '/tech-icon-512.png',
  '/tech-icon.svg'
];

// Service Worker Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => console.log('[SW] Cache prefetch note:', err));
    })
  );
  self.skipWaiting();
});

// Service Worker Activate & Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Support Safe In-App Update trigger
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Handler (Network first with cache fallback)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Let API requests pass directly to network; offline cache handles data in IndexedDB
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// ==================================================
// REAL WEB PUSH NOTIFICATION HANDLER
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

  const title = data.title || 'New PestControl Assignment';
  const options = {
    body: data.body || 'You have an operational update.',
    icon: data.icon || '/tech-icon-192.png',
    badge: data.badge || '/tech-icon.svg',
    tag: data.tag || 'pestcontrol-job',
    renotify: true,
    requireInteraction: true,
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    data: data.data || { url: '/tech' },
    actions: data.actions || [
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

  const targetUrl = event.notification.data?.url || '/tech';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes('/tech')) {
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
