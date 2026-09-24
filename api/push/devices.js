/**
 * Vercel Serverless Function: /api/push/devices/[id]
 */
const { supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const techId = req.query.id || req.query.techId || req.url.split('/').pop().split('?')[0];
    const { data, error } = await supabase
      .from('technician_devices')
      .select('id, device_id, platform, browser, is_active, created_at, last_seen_at')
      .eq('technician_id', techId)
      .eq('is_active', 1)
      .order('last_seen_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ success: true, devices: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
