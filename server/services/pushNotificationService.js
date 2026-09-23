const webpush = require('web-push');
const db = require('../db');

/**
 * Initialize VAPID Keys from database or generate new ones
 */
function initVapidKeys() {
  let vapidRow = db.prepare('SELECT * FROM push_vapid_keys WHERE id = 1').get();
  if (!vapidRow) {
    const keys = webpush.generateVAPIDKeys();
    db.prepare(`
      INSERT INTO push_vapid_keys (id, public_key, private_key)
      VALUES (1, ?, ?)
    `).run(keys.publicKey, keys.privateKey);
    vapidRow = { id: 1, public_key: keys.publicKey, private_key: keys.privateKey };
    console.log('[WebPush] Generated new VAPID keys pair.');
  }

  webpush.setVapidDetails(
    'mailto:operations@pestcontrol.lk',
    vapidRow.public_key,
    vapidRow.private_key
  );

  return vapidRow;
}

const vapidKeys = initVapidKeys();

function getVapidPublicKey() {
  return vapidKeys.public_key;
}

/**
 * Register or update device push subscription for a technician
 */
function registerDeviceSubscription({
  technician_id,
  user_id = null,
  device_id,
  subscription,
  platform = 'Unknown',
  browser = 'Unknown'
}) {
  if (!technician_id || !subscription || !subscription.endpoint) {
    throw new Error('technician_id and subscription with endpoint are required');
  }

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh || '';
  const auth = subscription.keys?.auth || '';
  const devId = device_id || `dev_${Math.random().toString(36).substring(2, 10)}`;

  const existing = db.prepare('SELECT * FROM technician_devices WHERE endpoint = ?').get(endpoint);

  if (existing) {
    db.prepare(`
      UPDATE technician_devices SET
        technician_id = ?,
        user_id = COALESCE(?, user_id),
        device_id = ?,
        p256dh = ?,
        auth = ?,
        platform = ?,
        browser = ?,
        is_active = 1,
        last_seen_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE endpoint = ?
    `).run(technician_id, user_id, devId, p256dh, auth, platform, browser, endpoint);
  } else {
    db.prepare(`
      INSERT INTO technician_devices (
        technician_id, user_id, device_id, endpoint, p256dh, auth, platform, browser, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(technician_id, user_id, devId, endpoint, p256dh, auth, platform, browser);
  }

  return { success: true, device_id: devId };
}

/**
 * Unsubscribe or deactivate device
 */
function unregisterDevice(endpoint) {
  if (!endpoint) return false;
  db.prepare('UPDATE technician_devices SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE endpoint = ?').run(endpoint);
  return true;
}

/**
 * List active devices for a technician
 */
function getTechnicianDevices(technicianId) {
  return db.prepare(`
    SELECT id, device_id, platform, browser, created_at, last_seen_at, is_active
    FROM technician_devices
    WHERE technician_id = ? AND is_active = 1
    ORDER BY last_seen_at DESC
  `).all(technicianId);
}

/**
 * Send real Web Push Notification to all active devices of a technician
 */
async function sendPushToTechnician(technicianId, {
  type = 'ADMIN_MESSAGE',
  title,
  body,
  jobId = null,
  url = '/tech',
  tag = null,
  actions = []
}) {
  if (!technicianId) return { success: false, error: 'No technician specified' };

  const devices = db.prepare(`
    SELECT * FROM technician_devices
    WHERE technician_id = ? AND is_active = 1
  `).all(technicianId);

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
    },
    actions: actions.length > 0 ? actions : [
      { action: 'open', title: 'Open Job' }
    ]
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const device of devices) {
    const pushSubscription = {
      endpoint: device.endpoint,
      keys: {
        p256dh: device.p256dh,
        auth: device.auth
      }
    };

    try {
      await webpush.sendNotification(pushSubscription, payload);
      sentCount++;

      db.prepare(`
        INSERT INTO push_notification_logs (
          technician_id, device_id, notification_type, title, body, data_payload, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'SENT')
      `).run(technicianId, device.device_id, type, title, body, payload);

      db.prepare('UPDATE technician_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(device.id);
    } catch (err) {
      failedCount++;
      console.warn(`[WebPush] Failed sending push to device ${device.device_id}:`, err.statusCode || err.message);

      db.prepare(`
        INSERT INTO push_notification_logs (
          technician_id, device_id, notification_type, title, body, data_payload, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, 'FAILED', ?)
      `).run(technicianId, device.device_id, type, title, body, payload, err.message);

      // If subscription has expired or unsubscribed (410 or 404), mark inactive
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('UPDATE technician_devices SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(device.id);
      }
    }
  }

  return { success: true, sentCount, failedCount, totalDevices: devices.length };
}

/**
 * Standard Operational Workflow Push Notifications
 */

async function notifyJobAssigned(jobId, technicianId) {
  const job = db.prepare(`
    SELECT j.*, c.name as customer_name
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ?
  `).get(jobId);

  if (!job || !technicianId) return null;

  const timeStr = job.scheduled_time || '09:00 AM';
  return sendPushToTechnician(technicianId, {
    type: 'NEW_JOB',
    title: 'New Job Assigned',
    body: `${job.customer_name} - ${job.scheduled_date} at ${timeStr}`,
    jobId: job.id,
    url: `/tech?job=${job.id}`,
    tag: `job-assign-${job.id}`
  });
}

async function notifyJobUpdated(jobId, technicianId, notes) {
  const job = db.prepare(`
    SELECT j.*, c.name as customer_name
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ?
  `).get(jobId);

  if (!job || !technicianId) return null;

  return sendPushToTechnician(technicianId, {
    type: 'JOB_UPDATED',
    title: 'Job Updated',
    body: `${job.customer_name} schedule has been updated${notes ? `: ${notes}` : '.'}`,
    jobId: job.id,
    url: `/tech?job=${job.id}`,
    tag: `job-update-${job.id}`
  });
}

async function notifyJobCancelled(jobId, technicianId) {
  const job = db.prepare(`
    SELECT j.*, c.name as customer_name
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ?
  `).get(jobId);

  if (!job || !technicianId) return null;

  const timeStr = job.scheduled_time || '09:00 AM';
  return sendPushToTechnician(technicianId, {
    type: 'JOB_CANCELLED',
    title: 'Job Cancelled',
    body: `${job.customer_name} - ${timeStr} (CANCELLED)`,
    jobId: job.id,
    url: `/tech?job=${job.id}`,
    tag: `job-cancel-${job.id}`
  });
}

async function notifyJobPostponed(jobId, technicianId, newDate) {
  const job = db.prepare(`
    SELECT j.*, c.name as customer_name
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ?
  `).get(jobId);

  if (!job || !technicianId) return null;

  return sendPushToTechnician(technicianId, {
    type: 'JOB_POSTPONED',
    title: 'Job Postponed',
    body: `${job.customer_name} rescheduled to ${newDate}`,
    jobId: job.id,
    url: `/tech?job=${job.id}`,
    tag: `job-postpone-${job.id}`
  });
}

async function notifyJobReminder(jobId, technicianId, hoursBefore) {
  const job = db.prepare(`
    SELECT j.*, c.name as customer_name
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ?
  `).get(jobId);

  if (!job || !technicianId) return null;

  return sendPushToTechnician(technicianId, {
    type: 'JOB_REMINDER',
    title: 'Job Reminder',
    body: `Upcoming service at ${job.customer_name} in ${hoursBefore} hours (${job.scheduled_time || 'scheduled'}).`,
    jobId: job.id,
    url: `/tech?job=${job.id}`,
    tag: `job-remind-${job.id}-${hoursBefore}h`
  });
}

module.exports = {
  getVapidPublicKey,
  registerDeviceSubscription,
  unregisterDevice,
  getTechnicianDevices,
  sendPushToTechnician,
  notifyJobAssigned,
  notifyJobUpdated,
  notifyJobCancelled,
  notifyJobPostponed,
  notifyJobReminder
};
