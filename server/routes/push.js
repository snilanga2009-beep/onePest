const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  getVapidPublicKey,
  registerDeviceSubscription,
  unregisterDevice,
  getTechnicianDevices,
  sendPushToTechnician
} = require('../services/pushNotificationService');

// GET VAPID Public Key for browser PushManager subscription
router.get('/vapid-public-key', (req, res) => {
  try {
    const key = getVapidPublicKey();
    res.json({ success: true, publicKey: key });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Register Device Push Subscription
router.post('/subscribe', (req, res) => {
  const { technician_id, user_id, device_id, subscription, platform, browser } = req.body;

  if (!technician_id || !subscription) {
    return res.status(400).json({
      success: false,
      error: 'technician_id and subscription object are required'
    });
  }

  try {
    const result = registerDeviceSubscription({
      technician_id: parseInt(technician_id, 10),
      user_id: user_id ? parseInt(user_id, 10) : null,
      device_id,
      subscription,
      platform,
      browser
    });

    res.json({
      success: true,
      message: 'Device push subscription registered successfully',
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Unsubscribe Device
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'endpoint is required' });
  }

  try {
    unregisterDevice(endpoint);
    res.json({ success: true, message: 'Device unsubscribed from push notifications' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Active Devices for a Technician
router.get('/devices/:techId', (req, res) => {
  const { techId } = req.params;
  try {
    const devices = getTechnicianDevices(parseInt(techId, 10));
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Send Immediate Test Push Notification
router.post('/send-test', async (req, res) => {
  const { technician_id, title, body } = req.body;
  if (!technician_id) {
    return res.status(400).json({ success: false, error: 'technician_id is required' });
  }

  try {
    const result = await sendPushToTechnician(parseInt(technician_id, 10), {
      type: 'ADMIN_MESSAGE',
      title: title || 'PestControl Pro Test Alert',
      body: body || 'Real Web Push test notification delivered to your technician device!',
      url: '/tech',
      tag: `test-${Date.now()}`
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Push Notification Logs for Audit
router.get('/logs', (req, res) => {
  const { technician_id, limit = 50 } = req.query;
  try {
    let logs = [];
    if (technician_id) {
      logs = db.prepare(`
        SELECT p.*, s.full_name as technician_name
        FROM push_notification_logs p
        LEFT JOIN staff s ON p.technician_id = s.id
        WHERE p.technician_id = ?
        ORDER BY p.id DESC
        LIMIT ?
      `).all(parseInt(technician_id, 10), parseInt(limit, 10));
    } else {
      logs = db.prepare(`
        SELECT p.*, s.full_name as technician_name
        FROM push_notification_logs p
        LEFT JOIN staff s ON p.technician_id = s.id
        ORDER BY p.id DESC
        LIMIT ?
      `).all(parseInt(limit, 10));
    }

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
