/**
-- Firebase Cloud Messaging (FCM) Background Service Worker
-- Production Web Push for Pest Control PWA (Android, iOS, iPad, Desktop)
**/

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Parse query params or fallback
const params = new URLSearchParams(location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  projectId: params.get('projectId') || '',
  messagingSenderId: params.get('messagingSenderId') || '103953800507',
  appId: params.get('appId') || ''
};

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw] Received background message:', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || 'PestControl Pro Update';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'New operational update received.',
      icon: payload.data?.icon || '/tech-icon-192.png',
      badge: payload.data?.badge || '/tech-icon.svg',
      tag: payload.data?.tag || `job-${payload.data?.jobId || Date.now()}`,
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      data: {
        url: payload.data?.url || (payload.data?.jobId ? `/tech?job=${payload.data.jobId}` : '/tech'),
        jobId: payload.data?.jobId,
        type: payload.data?.type || 'NEW_JOB'
      },
      actions: [
        { action: 'open', title: 'Open Job' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Fallback native push listener for universal web push payloads
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'PestControl Assignment', body: event.data.text() };
  }

  const title = data.notification?.title || data.data?.title || data.title || 'PestControl Pro';
  const body = data.notification?.body || data.data?.body || data.body || 'You have an operational update.';
  const payloadData = data.data || data;
  const targetUrl = payloadData.url || (payloadData.jobId ? `/tech?job=${payloadData.jobId}` : '/tech');

  const options = {
    body,
    icon: '/tech-icon-192.png',
    badge: '/tech-icon.svg',
    tag: payloadData.tag || `job-${payloadData.jobId || Date.now()}`,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      url: targetUrl,
      jobId: payloadData.jobId,
      type: payloadData.type
    },
    actions: [
      { action: 'open', title: 'Open Job' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Deep-link notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/tech';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client && client.url.includes('/tech')) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
