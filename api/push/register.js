/**
 * Vercel Serverless Function: /api/push/register
 * Registers or updates technician device FCM tokens in Supabase
 * Supports multi-device per technician (Android, iOS PWA, iPad, Desktop)
 */

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
    const { technician_id, device_id, fcm_token, platform = 'Unknown', browser = 'Unknown' } = req.body || {};

    if (!technician_id || !fcm_token) {
      return res.status(400).json({ success: false, error: 'technician_id and fcm_token are required' });
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(200).json({
        success: true,
        message: 'Device token received (Supabase credentials not configured in environment)'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert into technician_devices
    const { data, error } = await supabase
      .from('technician_devices')
      .upsert(
        {
          technician_id: parseInt(technician_id, 10),
          device_id: device_id || `dev_${Math.random().toString(36).substring(2, 10)}`,
          fcm_token,
          platform,
          browser,
          is_active: 1,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'fcm_token' }
      );

    if (error) {
      console.error('[Register FCM Token] Supabase error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Technician device successfully registered for push notifications'
    });
  } catch (error) {
    console.error('[Register FCM Token] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
