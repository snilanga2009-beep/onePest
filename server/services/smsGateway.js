const db = require('../db');
const os = require('os');

/**
 * Sri Lanka Mobile Operator Prefix Mapping
 */
const OPERATOR_PREFIXES = {
  '77': 'Dialog Axiata',
  '76': 'Dialog Axiata',
  '74': 'Dialog Axiata',
  '71': 'SLT-Mobitel',
  '70': 'SLT-Mobitel',
  '78': 'Hutch',
  '72': 'Hutch',
  '75': 'Airtel'
};

/**
 * Normalize and validate Sri Lankan mobile phone number
 * Examples:
 *   "0771234567" -> "94771234567"
 *   "+94 77 123 4567" -> "94771234567"
 *   "771234567" -> "94771234567"
 */
function normalizeSriLankaPhone(phone) {
  if (!phone) {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Strip all non-digit characters
  const raw = String(phone).trim();
  let digits = raw.replace(/\D/g, '');

  // Strip leading 00 if international format (0094...)
  if (digits.startsWith('0094')) {
    digits = digits.substring(2);
  }

  // Handle local 10-digit format starting with 0 (e.g., 0771234567)
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '94' + digits.substring(1);
  }

  // Handle 9-digit format without leading 0 or country code (e.g., 771234567)
  if (digits.length === 9 && digits.startsWith('7')) {
    digits = '94' + digits;
  }

  // Verify Sri Lanka international format: 94 + 7X + 7 digits (Total: 11 digits)
  const slRegex = /^94(70|71|72|74|75|76|77|78)\d{7}$/;
  if (!slRegex.test(digits)) {
    // If it's 11 digits but starts with 94 followed by other numbers
    if (digits.startsWith('94') && digits.length === 11) {
      return {
        isValid: true,
        normalized: digits,
        operator: 'Sri Lanka Mobile',
        nationalFormat: `0${digits.substring(2, 4)} ${digits.substring(4, 7)} ${digits.substring(7)}`,
        warning: 'Non-standard mobile prefix'
      };
    }
    return {
      isValid: false,
      raw: phone,
      digits,
      error: `Invalid Sri Lankan mobile format "${phone}". Expected 10-digit local (e.g. 0771234567) or international (+94771234567)`
    };
  }

  const prefix = digits.substring(2, 4);
  const operator = OPERATOR_PREFIXES[prefix] || 'Sri Lanka Mobile';
  const nationalFormat = `0${prefix} ${digits.substring(4, 7)} ${digits.substring(7)}`;

  return {
    isValid: true,
    normalized: digits,
    operator,
    nationalFormat
  };
}

/**
 * Get current SMS Gateway settings from database
 */
function getSmsSettings() {
  const settings = db.prepare('SELECT * FROM sms_settings WHERE id = 1').get();
  if (!settings) {
    db.prepare(`
      INSERT INTO sms_settings (id, provider, api_key, user_id, sender_id, is_simulation, is_active)
      VALUES (1, 'NOTIFY_LK', '', '', 'PESTCONTROL', 1, 1)
    `).run();
    return db.prepare('SELECT * FROM sms_settings WHERE id = 1').get();
  }
  return settings;
}

/**
 * Update SMS Gateway settings
 */
/**
 * Update SMS Gateway settings
 */
function updateSmsSettings(data) {
  let {
    provider = 'TEXT_LK',
    api_key = '',
    api_token = '',
    user_id = '',
    sender_id = 'TextLKDemo',
    password = '',
    endpoint_url = '',
    system_url = '',
    is_simulation = 1,
    is_active = 1
  } = data;

  api_key = String(api_key || '').trim();
  api_token = String(api_token || '').trim();
  user_id = String(user_id || '').trim();
  sender_id = String(sender_id || '').trim();
  endpoint_url = String(endpoint_url || '').trim();

  // If endpoint_url was accidentally set to an invalid relative route, clear it
  if (endpoint_url && !endpoint_url.startsWith('http://') && !endpoint_url.startsWith('https://')) {
    endpoint_url = '';
  }

  // Text.lk Demo Sender ID is strictly case-sensitive: 'TextLKDemo'
  if (provider === 'TEXT_LK' && sender_id.toUpperCase() === 'TEXTLKDEMO') {
    sender_id = 'TextLKDemo';
  }

  db.prepare(`
    UPDATE sms_settings
    SET provider = ?, api_key = ?, api_token = ?, user_id = ?, sender_id = ?,
        password = ?, endpoint_url = ?, system_url = ?, is_simulation = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    provider,
    api_key,
    api_token,
    user_id,
    sender_id,
    password,
    endpoint_url,
    system_url,
    Number(is_simulation),
    Number(is_active)
  );

  return getSmsSettings();
}

/**
 * Dispatch real HTTP request to chosen Sri Lanka SMS Gateway provider
 */
async function dispatchToProvider(settings, toPhone, messageText) {
  const provider = settings.provider;
  let senderId = (settings.sender_id || 'TextLKDemo').trim();

  switch (provider) {
    case 'TEXT_LK': {
      // Text.lk REST API v3 (Bearer Token)
      const url = (settings.endpoint_url && settings.endpoint_url.startsWith('http'))
        ? settings.endpoint_url
        : 'https://app.text.lk/api/v3/sms/send';

      const token = (settings.api_key || settings.api_token || '').trim();
      if (!token) {
        throw new Error('Text.lk requires an API Token. Obtain it from your Text.lk Dashboard under Developers.');
      }

      // Text.lk demo sender ID is strictly case-sensitive: 'TextLKDemo'
      if (senderId.toUpperCase() === 'TEXTLKDEMO') {
        senderId = 'TextLKDemo';
      }

      const body = {
        recipient: toPhone, // 947XXXXXXXX
        sender_id: senderId,
        type: 'plain',
        message: messageText
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok || data.status === 'error' || data.status === 'failed') {
        let errMsg = data.message || (data.errors ? Object.values(data.errors).flat().join(', ') : `Text.lk error HTTP ${response.status}`);
        if (errMsg === 'Failed' || response.status === 403) {
          errMsg = `Text.lk rejected the dispatch ('Failed'). Cause: Sender ID "${senderId}" is not registered, unapproved, or case-mismatched. For Text.lk Demo accounts, use exact case: 'TextLKDemo'. For custom brands, ensure the Sender ID is approved in your Text.lk Dashboard.`;
        }
        throw new Error(errMsg);
      }

      return {
        messageId: data.data?.uid || data.data?.id || `TEXTLK-${Date.now()}`,
        cost: Number(data.data?.cost || 0.35),
        rawResponse: data
      };
    }

    case 'NOTIFY_LK': {
      // Notify.lk REST API
      const url = 'https://app.notify.lk/api/v1/send';
      const params = new URLSearchParams({
        user_id: settings.user_id || '',
        api_key: settings.api_key || '',
        sender_id: senderId,
        to: toPhone,
        message: messageText
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const data = await response.json();
      if (!response.ok || data.status === 'error') {
        const errDetail = data.errors ? Object.values(data.errors).flat().join(', ') : data.message;
        throw new Error(errDetail || `Notify.lk error HTTP ${response.status}`);
      }
      return {
        messageId: data.data?.message_id || `NOTIFY-${Date.now()}`,
        cost: 0.35,
        rawResponse: data
      };
    }

    case 'DIALOG': {
      // Dialog Axiata Enterprise / RichMessage SMS API
      const url = settings.endpoint_url || 'https://richmessage.dialog.lk/api/sms/send';
      const authHeader = settings.api_token
        ? `Bearer ${settings.api_token}`
        : settings.user_id && settings.password
        ? `Basic ${Buffer.from(`${settings.user_id}:${settings.password}`).toString('base64')}`
        : settings.api_key ? `ApiKey ${settings.api_key}` : '';

      const body = {
        msisdn: [toPhone],
        message: messageText,
        sourceAddress: senderId,
        transactionId: `PEST-${Date.now()}`
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {})
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.errorMessage || data.message || `Dialog SMS error HTTP ${response.status}`);
      }
      return {
        messageId: data.transactionId || data.messageId || `DIALOG-${Date.now()}`,
        cost: 0.40,
        rawResponse: data
      };
    }

    case 'MOBITEL': {
      // Mobitel Enterprise SMS API
      const url = settings.endpoint_url || 'https://sms.mobitel.lk/api/send';
      const body = {
        serviceId: settings.user_id || 'PEST_SERVICE',
        username: settings.user_id || '',
        password: settings.password || settings.api_key || '',
        recipient: toPhone,
        message: messageText,
        sender: senderId
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Mobitel SMS error HTTP ${response.status}`);
      }
      return {
        messageId: data.id || `MOBITEL-${Date.now()}`,
        cost: 0.38,
        rawResponse: data
      };
    }

    case 'SHOUTOUT': {
      // ShoutOUT Sri Lanka API
      const url = 'https://api.getshoutout.com/coreservice/v1/sms/send';
      const body = {
        source: senderId,
        destinations: [toPhone],
        content: { sms: messageText }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${settings.api_key || ''}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `ShoutOUT error HTTP ${response.status}`);
      }
      return {
        messageId: data.id || `SHOUTOUT-${Date.now()}`,
        cost: 0.45,
        rawResponse: data
      };
    }

    case 'CUSTOM': {
      // Custom Gateway URL template
      let customUrl = settings.endpoint_url || '';
      if (!customUrl) {
        throw new Error('Custom Gateway requires a valid Endpoint URL in settings');
      }

      // Replace placeholders
      customUrl = customUrl
        .replace('{TO}', encodeURIComponent(toPhone))
        .replace('{MESSAGE}', encodeURIComponent(messageText))
        .replace('{SENDER_ID}', encodeURIComponent(senderId))
        .replace('{API_KEY}', encodeURIComponent(settings.api_key || ''))
        .replace('{USER_ID}', encodeURIComponent(settings.user_id || ''));

      const response = await fetch(customUrl, { method: 'POST' });
      const text = await response.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { text }; }

      if (!response.ok) {
        throw new Error(`Custom Gateway error HTTP ${response.status}: ${text}`);
      }
      return {
        messageId: `CUSTOM-${Date.now()}`,
        cost: 0.40,
        rawResponse: parsed
      };
    }

    default:
      throw new Error(`Unsupported SMS provider: ${provider}`);
  }
}

/**
 * Send an SMS message with automated validation, simulation fallback, and persistence logging
 */
async function sendSMS({ to, message, jobId = null, recipientName = null }) {
  const norm = normalizeSriLankaPhone(to);
  if (!norm.isValid) {
    // Record failed attempt
    db.prepare(`
      INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
      VALUES (?, ?, ?, ?, 'VALIDATOR', 'FAILED', 0.0, ?)
    `).run(jobId, to || 'EMPTY', recipientName || '', message, norm.error);

    return {
      success: false,
      error: norm.error,
      phone: to
    };
  }

  const settings = getSmsSettings();
  const phone = norm.normalized;
  const isSimulation = Boolean(settings.is_simulation);

  if (!isSimulation) {
    // Check credentials for chosen live provider
    if (settings.provider === 'TEXT_LK' && (!settings.api_key && !settings.api_token)) {
      const errMsg = 'Live SMS via Text.lk requires an API Token. Please enter your API Token in Settings → Sri Lanka SMS Gateway.';
      db.prepare(`
        INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
        VALUES (?, ?, ?, ?, 'TEXT_LK', 'FAILED', 0.0, ?)
      `).run(jobId, phone, recipientName || '', message, errMsg);
      return { success: false, error: errMsg, phone, provider: 'TEXT_LK' };
    }

    if (settings.provider === 'NOTIFY_LK' && (!settings.api_key || !settings.user_id)) {
      const errMsg = 'Live SMS via Notify.lk requires User ID and API Key. Please enter your credentials in Settings → Sri Lanka SMS Gateway.';
      db.prepare(`
        INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
        VALUES (?, ?, ?, ?, 'NOTIFY_LK', 'FAILED', 0.0, ?)
      `).run(jobId, phone, recipientName || '', message, errMsg);
      return { success: false, error: errMsg, phone, provider: 'NOTIFY_LK' };
    }

    if (settings.provider === 'DIALOG' && (!settings.api_key && !settings.api_token && !settings.password)) {
      const errMsg = 'Live SMS via Dialog requires API Key, Bearer Token, or Password. Please enter credentials in Settings.';
      db.prepare(`
        INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
        VALUES (?, ?, ?, ?, 'DIALOG', 'FAILED', 0.0, ?)
      `).run(jobId, phone, recipientName || '', message, errMsg);
      return { success: false, error: errMsg, phone, provider: 'DIALOG' };
    }

    if (settings.provider === 'MOBITEL' && (!settings.user_id || (!settings.password && !settings.api_key))) {
      const errMsg = 'Live SMS via Mobitel requires Username and Password. Please enter credentials in Settings.';
      db.prepare(`
        INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
        VALUES (?, ?, ?, ?, 'MOBITEL', 'FAILED', 0.0, ?)
      `).run(jobId, phone, recipientName || '', message, errMsg);
      return { success: false, error: errMsg, phone, provider: 'MOBITEL' };
    }

    if (settings.provider === 'SHOUTOUT' && !settings.api_key) {
      const errMsg = 'Live SMS via ShoutOUT requires an API Key. Please enter credentials in Settings.';
      db.prepare(`
        INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
        VALUES (?, ?, ?, ?, 'SHOUTOUT', 'FAILED', 0.0, ?)
      `).run(jobId, phone, recipientName || '', message, errMsg);
      return { success: false, error: errMsg, phone, provider: 'SHOUTOUT' };
    }

    if (settings.provider === 'CUSTOM' && !settings.endpoint_url) {
      const errMsg = 'Live SMS via Custom Gateway requires an Endpoint URL. Please enter URL in Settings.';
      db.prepare(`
        INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
        VALUES (?, ?, ?, ?, 'CUSTOM', 'FAILED', 0.0, ?)
      `).run(jobId, phone, recipientName || '', message, errMsg);
      return { success: false, error: errMsg, phone, provider: 'CUSTOM' };
    }
  }

  if (isSimulation) {
    // Simulation Mode: instant, safe, no real telco cost, full audit log
    const simulatedMessageId = `SIM-LK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const costLkr = 0.35; // typical SL SMS cost: 35 cents

    const simResponse = {
      simulated: true,
      provider: settings.provider,
      sender_id: settings.sender_id || 'PESTCONTROL',
      message_id: simulatedMessageId,
      to_formatted: norm.nationalFormat,
      operator: norm.operator,
      char_count: message.length,
      estimated_cost_lkr: costLkr,
      status: 'DELIVERED_SIMULATION',
      note: 'Simulation Mode Active: Real SMS network dispatch bypassed. Switch off Simulation Mode in Settings when live credentials are set.'
    };

    // Log to sms_logs table
    db.prepare(`
      INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
      VALUES (?, ?, ?, ?, ?, 'SIMULATED', ?, ?)
    `).run(
      jobId,
      phone,
      recipientName || '',
      message,
      settings.provider,
      costLkr,
      JSON.stringify(simResponse)
    );

    // If attached to a job, log in job_logs
    if (jobId) {
      db.prepare(`
        INSERT INTO job_logs (job_id, action, notes)
        VALUES (?, 'SMS_REMINDER_SENT', ?)
      `).run(
        jobId,
        `SMS Reminder (${settings.provider} [SIMULATED]) sent to ${recipientName || 'Customer'} (${norm.nationalFormat}): "${message.substring(0, 60)}..."`
      );
    }

    return {
      success: true,
      simulated: true,
      messageId: simulatedMessageId,
      phone,
      formattedPhone: norm.nationalFormat,
      operator: norm.operator,
      provider: settings.provider,
      costLkr,
      details: simResponse
    };
  }

  // Live Gateway Dispatch
  try {
    const result = await dispatchToProvider(settings, phone, message);

    db.prepare(`
      INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
      VALUES (?, ?, ?, ?, ?, 'SENT', ?, ?)
    `).run(
      jobId,
      phone,
      recipientName || '',
      message,
      settings.provider,
      result.cost || 0.35,
      JSON.stringify(result.rawResponse || {})
    );

    if (jobId) {
      db.prepare(`
        INSERT INTO job_logs (job_id, action, notes)
        VALUES (?, 'SMS_REMINDER_SENT', ?)
      `).run(
        jobId,
        `Live SMS sent via ${settings.provider} to ${recipientName || 'Customer'} (${norm.nationalFormat}) [ID: ${result.messageId}]`
      );
    }

    return {
      success: true,
      simulated: false,
      messageId: result.messageId,
      phone,
      formattedPhone: norm.nationalFormat,
      operator: norm.operator,
      provider: settings.provider,
      costLkr: result.cost || 0.35
    };
  } catch (err) {
    db.prepare(`
      INSERT INTO sms_logs (job_id, phone, recipient_name, message, gateway, status, cost_lkr, response)
      VALUES (?, ?, ?, ?, ?, 'FAILED', 0.0, ?)
    `).run(
      jobId,
      phone,
      recipientName || '',
      message,
      settings.provider,
      err.message
    );

    return {
      success: false,
      error: `SMS Gateway Delivery Failed: ${err.message}`,
      phone,
      provider: settings.provider
    };
  }
}

function getNetworkIpAddress() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function resolveSystemBaseUrl(customBaseUrl) {
  const settings = getSmsSettings();
  const configured = (settings.system_url || '').trim().replace(/\/$/, '');

  // 1. If configured system_url in settings is a real live domain / tunnel (not localhost), always prioritize it for SMS recipients!
  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured;
  }

  // 2. If customBaseUrl is provided from caller and is not localhost, use it
  if (customBaseUrl) {
    const trimmed = customBaseUrl.trim().replace(/\/$/, '');
    if (!trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
      return trimmed;
    }
  }

  // 3. If everything points to localhost, resolve to the PC's Wi-Fi network IP (e.g. http://192.168.1.12:3000)
  const netIp = getNetworkIpAddress();
  if (netIp) {
    const port = (customBaseUrl && customBaseUrl.split(':')[2]) || (configured && configured.split(':')[2]) || '3000';
    return `http://${netIp}:${port}`;
  }

  return (configured || customBaseUrl || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Message template generators for pest control operational workflows
 */
function build24hReminderMessage(job, customBaseUrl) {
  const baseUrl = resolveSystemBaseUrl(customBaseUrl);
  const clientName = job.contact_person || job.customer_name || 'Valued Customer';
  const treatment = job.treatment_code || 'Pest Control';
  const date = job.scheduled_date;
  const time = job.scheduled_time || '09:00 AM';
  const tech = job.technician_name || 'Field Specialist';
  const loc = job.location_name || 'your premises';

  return `PestControl Pro: Reminder that your ${treatment} service is scheduled for tomorrow ${date} at ${time} (${loc}). Specialist: ${tech}. To confirm or reschedule: ${baseUrl}/confirmations/${job.job_code} or Call 011-2345678`;
}

function buildArrivalReminderMessage(job) {
  const clientName = job.contact_person || job.customer_name || 'Valued Customer';
  const tech = job.technician_name || 'on duty';
  const treatment = job.treatment_code || 'Pest Control';
  const time = job.scheduled_time || 'today';

  return `PestControl Pro: Our specialist ${tech} is en-route for your scheduled ${treatment} service today at approx ${time}. Thank you for choosing PestControl Pro! Hotline: 011-2345678`;
}

function buildJobCompletionMessage(job) {
  const clientName = job.contact_person || job.customer_name || 'Customer';
  const treatment = job.treatment_code || 'Pest Control';
  return `PestControl Pro: Your ${treatment} service has been completed successfully today. Thank you for partnering with PestControl Pro. Support: 011-2345678`;
}

function buildTechDispatchMessage(job, customBaseUrl) {
  const baseUrl = resolveSystemBaseUrl(customBaseUrl);
  const techName = job.technician_name || 'Specialist';
  const customerName = job.customer_name || 'Client';
  const treatment = job.treatment_code || 'Service';
  const date = job.scheduled_date || 'Today';
  const time = job.scheduled_time || '09:00';
  const loc = job.location_name || job.location_address || 'Premises';
  const jobUrl = `${baseUrl}/tech?job=${job.id}`;

  return `PestControl: Hello ${techName}, Job #${job.job_code} assigned for ${customerName} on ${date} at ${time} (${treatment} @ ${loc}). Tap link to open your mobile work panel & start work: ${jobUrl}`;
}

module.exports = {
  OPERATOR_PREFIXES,
  normalizeSriLankaPhone,
  getSmsSettings,
  updateSmsSettings,
  sendSMS,
  build24hReminderMessage,
  buildArrivalReminderMessage,
  buildJobCompletionMessage,
  buildTechDispatchMessage
};
