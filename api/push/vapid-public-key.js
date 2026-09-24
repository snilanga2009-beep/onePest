/**
 * Vercel Serverless Function: /api/push/vapid-public-key
 * Returns VAPID public key for WebPush PushManager subscription
 */
const { getVapidPublicKey } = require('../lib/push');

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
    const publicKey = getVapidPublicKey();
    return res.status(200).json({ success: true, publicKey });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
