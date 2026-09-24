/**
 * Vercel Serverless Function: /api/push/send
 * Dispatches real Web Push notifications using Firebase Admin SDK (FCM)
 * Keeps Firebase service account private key & Supabase Service Role key server-side.
 */

let adminInstance = null;

function getFirebaseAdmin() {
  if (adminInstance) return adminInstance;

  const admin = require('firebase-admin');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  // Handle escaped newlines in environment variable
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }

  adminInstance = admin;
  return adminInstance;
}

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const {
      technician_id,
      type = 'OPERATIONAL_UPDATE',
      title,
      body,
      jobId = null,
      url = '/tech',
      tag = null
    } = req.body || {};

    if (!technician_id || !title || !body) {
      return res.status(400).json({
        success: false,
        error: 'technician_id, title, and body are required'
      });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      const { sendPushToTechnician } = require('../lib/push');
      const { supabase } = require('../lib/supabase');
      const result = await sendPushToTechnician(supabase, technician_id, {
        type,
        title,
        body,
        jobId,
        url: url || (jobId ? `/tech?job=${jobId}` : '/tech'),
        tag
      });
      return res.status(200).json(result);
    }

    // Connect to Supabase via Service Role to fetch registered technician FCM tokens
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let devices = [];
    let supabase = null;

    if (supabaseUrl && supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: dbDevices, error: devError } = await supabase
        .from('technician_devices')
        .select('*')
        .eq('technician_id', technician_id)
        .eq('is_active', 1);

      if (!devError && dbDevices) {
        devices = dbDevices;
      }
    }

    if (devices.length === 0) {
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: 'No registered push devices found for technician'
      });
    }

    const targetUrl = url || (jobId ? `/tech?job=${jobId}` : '/tech');
    const notificationTag = tag || (jobId ? `job-${jobId}` : `tech-${Date.now()}`);

    let sentCount = 0;
    let failedCount = 0;
    const invalidTokens = [];

    for (const device of devices) {
      if (!device.fcm_token) continue;

      const message = {
        token: device.fcm_token,
        notification: {
          title,
          body
        },
        data: {
          title,
          body,
          jobId: jobId ? String(jobId) : '',
          url: targetUrl,
          type: String(type),
          tag: notificationTag
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            title,
            body,
            icon: '/tech-icon-192.png',
            badge: '/tech-icon.svg',
            tag: notificationTag,
            requireInteraction: true
          },
          fcmOptions: {
            link: targetUrl
          }
        }
      };

      try {
        await admin.messaging().send(message);
        sentCount++;

        // Log push success to Supabase if available
        if (supabase) {
          await supabase.from('push_notification_logs').insert({
            technician_id,
            device_id: device.device_id,
            notification_type: type,
            title,
            body,
            data_payload: { jobId, url: targetUrl, type },
            status: 'SENT'
          });
        }
      } catch (fcmError) {
        failedCount++;
        console.warn(`[FCM Push] Failed to send push to device ${device.device_id}:`, fcmError.code || fcmError.message);

        // Check if token has expired or is invalid
        if (
          fcmError.code === 'messaging/registration-token-not-registered' ||
          fcmError.code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(device.fcm_token);
        }

        if (supabase) {
          await supabase.from('push_notification_logs').insert({
            technician_id,
            device_id: device.device_id,
            notification_type: type,
            title,
            body,
            data_payload: { jobId, url: targetUrl, type },
            status: 'FAILED',
            error_message: fcmError.message
          });
        }
      }
    }

    // Prune invalid tokens from Supabase
    if (supabase && invalidTokens.length > 0) {
      await supabase
        .from('technician_devices')
        .update({ is_active: 0, updated_at: new Date().toISOString() })
        .in('fcm_token', invalidTokens);
    }

    return res.status(200).json({
      success: true,
      sentCount,
      failedCount,
      totalDevices: devices.length
    });
  } catch (error) {
    console.error('[FCM Push Handler] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
