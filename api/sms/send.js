/**
 * Vercel Serverless Function: /api/sms/send
 * Dispatches Sri Lanka SMS via Text.lk while keeping API token server-side
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
    const { phone, message, job_id = null, recipient_name = '' } = req.body || {};

    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'phone and message are required' });
    }

    // Format Sri Lankan phone number (e.g. 0771234567 -> 94771234567)
    let cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.startsWith('0')) cleanPhone = '94' + cleanPhone.substring(1);

    const apiToken = process.env.TEXT_LK_API_TOKEN || '';
    const senderId = process.env.TEXT_LK_SENDER_ID || 'TextLKDemo';
    const isSimulation = !apiToken;

    if (isSimulation) {
      console.log(`[SMS Serverless Simulation] To: ${cleanPhone} | Sender: ${senderId} | Msg: ${message}`);
      return res.status(200).json({
        success: true,
        status: 'SIMULATED',
        phone: cleanPhone,
        message: 'SMS simulated successfully (TEXT_LK_API_TOKEN not configured)'
      });
    }

    // Real Text.lk HTTP dispatch
    const response = await fetch('https://app.text.lk/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        recipient: cleanPhone,
        sender_id: senderId,
        message: message
      })
    });

    const result = await response.json().catch(() => ({ status: 'unknown' }));

    return res.status(200).json({
      success: response.ok,
      status: response.ok ? 'SENT' : 'FAILED',
      result
    });
  } catch (error) {
    console.error('[SMS Serverless Handler] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
