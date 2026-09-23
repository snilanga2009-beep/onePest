import { isFirebaseConfigured, requestAndRegisterFcmToken } from './firebaseMessaging';

/**
 * Client-Side Web Push Notification Registration & Subscription Manager
 * Supports both Firebase Cloud Messaging (FCM) and standard WebPush (VAPID)
 */

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

function getDeviceId() {
  let devId = localStorage.getItem('tech_pwa_device_id');
  if (!devId) {
    devId = `pwa_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    localStorage.setItem('tech_pwa_device_id', devId);
  }
  return devId;
}

function detectPlatformAndBrowser() {
  const ua = navigator.userAgent;
  let platform = 'Desktop';
  if (/ipad/i.test(ua)) platform = 'iPad';
  else if (/iphone|ipod/i.test(ua)) platform = 'iOS';
  else if (/android/i.test(ua)) platform = 'Android';
  else if (/windows/i.test(ua)) platform = 'Windows';
  else if (/macintosh/i.test(ua)) platform = 'macOS';

  let browser = 'Browser';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/firefox/i.test(ua)) browser = 'Firefox';

  return { platform, browser };
}

export async function getPushSubscriptionStatus() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return { supported: false, permission: 'unsupported', isSubscribed: false };
  }

  const permission = Notification.permission;
  const fcmToken = localStorage.getItem('tech_fcm_token');

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = reg.pushManager ? await reg.pushManager.getSubscription() : null;
    return {
      supported: true,
      permission,
      isSubscribed: Boolean(sub || fcmToken),
      subscription: sub,
      fcmToken
    };
  } catch (err) {
    return { supported: true, permission, isSubscribed: Boolean(fcmToken), error: err.message };
  }
}

/**
 * Request permission and subscribe device to real Web Push Notifications
 */
export async function subscribeToPush(technicianId) {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported in this browser/device.');
  }

  // If Firebase is configured in production environment, use FCM
  if (isFirebaseConfigured()) {
    console.log('[PushManager] Using Firebase Cloud Messaging (FCM) engine.');
    return requestAndRegisterFcmToken(technicianId);
  }

  // Fallback: Standard Web Push with backend VAPID keys
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted by user.');
  }

  const keyRes = await fetch('/api/push/vapid-public-key');
  const keyData = await keyRes.json();
  if (!keyData.success || !keyData.publicKey) {
    throw new Error('Failed to retrieve VAPID public key from backend server.');
  }

  const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();

  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  const { platform, browser } = detectPlatformAndBrowser();
  const subPayload = {
    technician_id: parseInt(technicianId, 10),
    device_id: getDeviceId(),
    subscription: subscription.toJSON(),
    platform,
    browser
  };

  const saveRes = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subPayload)
  });

  const saveData = await saveRes.json();
  if (!saveData.success) {
    throw new Error(saveData.error || 'Failed to register push subscription on server.');
  }

  return { success: true, subscription, deviceId: getDeviceId() };
}

/**
 * Send an immediate test notification to this technician
 */
export async function triggerTestPush(technicianId) {
  // Try serverless /api/push/send first
  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        technician_id: parseInt(technicianId, 10),
        type: 'OPERATIONAL_UPDATE',
        title: 'PestControl Test Notification',
        body: 'Verified! Real Web Push notifications are active on this device.'
      })
    });
    if (res.ok) {
      return res.json();
    }
  } catch (e) {}

  // Fallback to Express /api/push/send-test
  const res = await fetch('/api/push/send-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      technician_id: parseInt(technicianId, 10),
      title: 'PestControl Test Notification',
      body: 'Verified! Real Web Push notifications are active on this device.'
    })
  });
  return res.json();
}
