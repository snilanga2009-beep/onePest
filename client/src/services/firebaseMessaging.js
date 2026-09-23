/**
 * Firebase Cloud Messaging (FCM) Web Push Service
 * Production-ready Web Push for Android, iOS (PWA), iPad, and Desktop
 * Dynamic Zero-Bundle Loading with Native WebPush Fallback
 */

// Client Firebase configuration from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '103953800507',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export const isFirebaseConfigured = () => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Detect client device platform & browser
 */
export function getDeviceInfo() {
  const ua = navigator.userAgent;
  let platform = 'Desktop';
  if (/ipad/i.test(ua)) platform = 'iPad';
  else if (/iphone|ipod/i.test(ua)) platform = 'iOS';
  else if (/android/i.test(ua)) platform = 'Android';
  else if (/macintosh/i.test(ua)) platform = 'macOS';
  else if (/windows/i.test(ua)) platform = 'Windows';

  let browser = 'Browser';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/firefox/i.test(ua)) browser = 'Firefox';

  let deviceId = localStorage.getItem('tech_fcm_device_id');
  if (!deviceId) {
    deviceId = `dev_${platform.toLowerCase()}_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    localStorage.setItem('tech_fcm_device_id', deviceId);
  }

  return { platform, browser, deviceId };
}

/**
 * Request permission and obtain real FCM Web Push Token
 */
export async function requestAndRegisterFcmToken(technicianId) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported on this device/browser.');
  }

  // 1. Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied.');
  }

  const swRegistration = await navigator.serviceWorker.ready;
  let fcmToken = null;

  // 2. Try Firebase Web SDK via official Google CDN
  try {
    const { initializeApp, getApps } = await import(/* @vite-ignore */ 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getMessaging, getToken, isSupported } = await import(/* @vite-ignore */ 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

    const supported = await isSupported().catch(() => false);
    if (supported) {
      const apps = getApps();
      const app = apps.length ? apps[0] : initializeApp(firebaseConfig);
      const messaging = getMessaging(app);

      const tokenOptions = { serviceWorkerRegistration: swRegistration };
      if (vapidKey) tokenOptions.vapidKey = vapidKey;

      fcmToken = await getToken(messaging, tokenOptions);
    }
  } catch (err) {
    console.warn('[FCM] Firebase SDK note, falling back to native PushManager:', err.message);
  }

  // 3. Fallback: Native PushManager with VAPID key
  if (!fcmToken && vapidKey && swRegistration.pushManager) {
    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    let sub = await swRegistration.pushManager.getSubscription();
    if (!sub) {
      sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }
    fcmToken = sub.endpoint;
  }

  if (!fcmToken) {
    throw new Error('Failed to retrieve FCM Web Push token.');
  }

  console.log('[FCM] Registered token successfully:', fcmToken.substring(0, 20) + '...');

  // 4. Save device token to server/Supabase
  const deviceInfo = getDeviceInfo();
  const payload = {
    technician_id: parseInt(technicianId, 10),
    device_id: deviceInfo.deviceId,
    fcm_token: fcmToken,
    platform: deviceInfo.platform,
    browser: deviceInfo.browser
  };

  await fetch('/api/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => null);

  localStorage.setItem('tech_fcm_token', fcmToken);

  return {
    success: true,
    token: fcmToken,
    deviceInfo
  };
}

/**
 * Listen for foreground push messages
 */
export async function listenForegroundMessages(onMessageReceived) {
  if (!isFirebaseConfigured()) return () => {};

  try {
    const { initializeApp, getApps } = await import(/* @vite-ignore */ 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getMessaging, onMessage } = await import(/* @vite-ignore */ 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

    const apps = getApps();
    const app = apps.length ? apps[0] : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    return onMessage(messaging, (payload) => {
      console.log('[FCM Foreground] Received message:', payload);
      if (typeof onMessageReceived === 'function') {
        onMessageReceived(payload);
      }
    });
  } catch (err) {
    return () => {};
  }
}
