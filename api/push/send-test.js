/**
 * Vercel Serverless Function: /api/push/send-test
 * Sends an immediate test WebPush notification to all registered devices of a technician
 */
const { supabase } = require('../lib/supabase');
const { sendPushToTechnician } = require('../lib/push');

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
    const { technician_id, title, body } = req.body || {};

    if (!technician_id) {
      return res.status(400).json({ success: false, error: 'technician_id is required' });
    }

    const result = await sendPushToTechnician(supabase, technician_id, {
      type: 'TEST_ALERT',
      title: title || 'PestControl Pro Test Alert',
      body: body || 'Real Web Push test notification delivered to your technician device!',
      url: '/tech',
      tag: `test-${Date.now()}`
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Push Send-Test] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
