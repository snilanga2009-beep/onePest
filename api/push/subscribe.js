/**
 * Vercel Serverless Function: /api/push/subscribe
 * Registers or updates technician browser push subscription in Supabase
 */
const { supabase } = require('../lib/supabase');
const { registerDeviceSubscription } = require('../lib/push');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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
    const { technician_id, device_id, subscription, fcm_token, platform, browser } = req.body || {};

    if (!technician_id) {
      return res.status(400).json({ success: false, error: 'technician_id is required' });
    }

    const result = await registerDeviceSubscription(supabase, {
      technician_id,
      device_id,
      subscription,
      fcm_token,
      platform,
      browser
    });

    return res.status(200).json({
      success: true,
      message: 'Push subscription registered successfully',
      ...result
    });
  } catch (err) {
    console.error('[Push Subscribe] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
