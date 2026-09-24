/**
 * Web Push Notification Service (VAPID + WebPush)
 * Supports all modern browsers (Chrome, Edge, Firefox, iOS 16.4+ Safari PWA)
 */
const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BBedqRuuuFL7uWZWtaq_RuRzy1ZmgrX6MrenCR7fStTN_BmFNxRS_EW0qozwOHxlL2-J0KKmLQXIdaiwf-Qrkww';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'n_E-0p-5p82IsECzohflPrvVD-7rg9-KOl_IsVG6cow';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:operations@pestcontrol.lk';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn('[WebPush] setVapidDetails warning:', e.message);
}

function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Register or update device subscription in Supabase technician_devices
 */
async function registerDeviceSubscription(supabase, {
  technician_id,
  device_id,
  subscription,
  fcm_token,
  platform = 'Unknown',
  browser = 'Unknown'
}) {
  if (!supabase) throw new Error('Supabase client is required');
  const techId = parseInt(technician_id, 10);
  if (!techId) throw new Error('Valid technician_id is required');

  const endpoint = subscription?.endpoint || (typeof fcm_token === 'string' && fcm_token.startsWith('http') ? fcm_token : '');
  const devId = device_id || `dev_${Math.random().toString(36).substring(2, 10)}`;
  const tokenString = subscription ? JSON.stringify(subscription) : (fcm_token || endpoint || devId);

  // Check if existing record for this device_id or endpoint
  let existing = null;
  if (endpoint) {
    const { data } = await supabase.from('technician_devices').select('*').eq('endpoint', endpoint).limit(1);
    if (data && data.length > 0) existing = data[0];
  }
  if (!existing && device_id) {
    const { data } = await supabase.from('technician_devices').select('*').eq('device_id', device_id).limit(1);
    if (data && data.length > 0) existing = data[0];
  }

  const nowIso = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from('technician_devices')
      .update({
        technician_id: techId,
        device_id: devId,
        fcm_token: tokenString,
        endpoint: endpoint || existing.endpoint,
        platform: platform || existing.platform,
        browser: browser || existing.browser,
        is_active: 1,
        last_seen_at: nowIso,
        updated_at: nowIso
      })
      .eq('id', existing.id)
      .select();
    if (error) throw error;
    return { success: true, device: data?.[0] };
  } else {
    const { data, error } = await supabase
      .from('technician_devices')
      .insert({
        technician_id: techId,
        device_id: devId,
        fcm_token: tokenString,
        endpoint: endpoint || null,
        platform,
        browser,
        is_active: 1,
        created_at: nowIso,
        updated_at: nowIso,
        last_seen_at: nowIso
      })
      .select();
    if (error) throw error;
    return { success: true, device: data?.[0] };
  }
}

/**
 * Send real Web Push notification to all active devices of a technician
 */
async function sendPushToTechnician(supabase, technicianId, {
  type = 'OPERATIONAL_UPDATE',
  title = 'PestControl Pro Update',
  body = '',
  jobId = null,
  url = '/tech',
  tag = null
}) {
  if (!supabase) return { success: false, error: 'Database not available' };
  const techId = parseInt(technicianId, 10);
  if (!techId) return { success: false, error: 'Valid technician_id required' };

  const { data: devices, error } = await supabase
    .from('technician_devices')
    .select('*')
    .eq('technician_id', techId)
    .eq('is_active', 1);

  if (error) return { success: false, error: error.message };
  if (!devices || devices.length === 0) {
    return { success: true, sentCount: 0, message: 'No registered push devices for technician' };
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/tech-icon-192.png',
    badge: '/tech-icon.svg',
    tag: tag || (jobId ? `job-${jobId}` : `tech-${Date.now()}`),
    vibrate: [200, 100, 200],
    data: {
      type,
      jobId,
      url: url || (jobId ? `/tech?job=${jobId}` : '/tech'),
      timestamp: Date.now()
    }
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const device of devices) {
    let pushSub = null;
    try {
      if (device.fcm_token && device.fcm_token.startsWith('{')) {
        pushSub = JSON.parse(device.fcm_token);
      } else if (device.endpoint) {
        pushSub = { endpoint: device.endpoint };
      }
    } catch (e) {
      if (device.endpoint) pushSub = { endpoint: device.endpoint };
    }

    if (!pushSub || !pushSub.endpoint) {
      continue;
    }

    try {
      await webpush.sendNotification(pushSub, payload);
      sentCount++;
      await supabase.from('technician_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id);
    } catch (pushErr) {
      failedCount++;
      console.warn(`[WebPush] Failed sending push to device ${device.id}:`, pushErr.statusCode || pushErr.message);
      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        // Expired subscription, mark inactive
        await supabase.from('technician_devices').update({ is_active: 0 }).eq('id', device.id);
      }
    }
  }

  return { success: true, sentCount, failedCount, totalDevices: devices.length };
}

/**
 * Broadcast push notification to all active technician devices
 */
async function broadcastPushToAll(supabase, {
  type = 'BROADCAST_ALERT',
  title = 'PestControl Operations Notice',
  body = '',
  url = '/tech'
}) {
  if (!supabase) return { success: false, error: 'Database not available' };
  const { data: devices, error } = await supabase
    .from('technician_devices')
    .select('*, staff!technician_devices_technician_id_fkey(*)')
    .eq('is_active', 1);

  if (error) return { success: false, error: error.message };
  if (!devices || devices.length === 0) {
    return { success: true, sentCount: 0, message: 'No registered push devices found' };
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/tech-icon-192.png',
    badge: '/tech-icon.svg',
    tag: `broadcast-${Date.now()}`,
    vibrate: [200, 100, 200],
    data: {
      type,
      url: url || '/tech',
      timestamp: Date.now()
    }
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const device of devices) {
    let pushSub = null;
    try {
      if (device.fcm_token && device.fcm_token.startsWith('{')) {
        pushSub = JSON.parse(device.fcm_token);
      } else if (device.endpoint) {
        pushSub = { endpoint: device.endpoint };
      }
    } catch (e) {
      if (device.endpoint) pushSub = { endpoint: device.endpoint };
    }

    if (!pushSub || !pushSub.endpoint) continue;

    try {
      await webpush.sendNotification(pushSub, payload);
      sentCount++;
      await supabase.from('technician_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id);
    } catch (pushErr) {
      failedCount++;
      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        await supabase.from('technician_devices').update({ is_active: 0 }).eq('id', device.id);
      }
    }
  }

  return { success: true, sentCount, failedCount, totalDevices: devices.length };
}

module.exports = {
  getVapidPublicKey,
  registerDeviceSubscription,
  sendPushToTechnician,
  broadcastPushToAll
};
