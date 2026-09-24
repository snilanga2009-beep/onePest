const { supabase } = require('./supabase');

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

const AVAILABLE_PROVIDERS = [
  {
    id: 'TEXT_LK',
    name: 'Text.lk',
    badge: 'Popular Sri Lanka SMS (Bearer Token)',
    description: 'High deliverability Sri Lankan SMS platform. Requires API Token from Developers section in Text.lk dashboard.',
    docsUrl: 'https://app.text.lk/',
    defaultSenderId: 'TextLKDemo',
    requiresPassword: false,
    requiresEndpointUrl: false,
    approxCostPerSms: 'LKR 0.35'
  },
  {
    id: 'NOTIFY_LK',
    name: 'Notify.lk',
    badge: 'Popular Developer Gateway',
    description: 'Direct REST API widely used in Sri Lanka. Requires User ID and API Key.',
    docsUrl: 'https://developer.notify.lk/',
    defaultSenderId: 'PESTCONTROL',
    requiresPassword: false,
    requiresEndpointUrl: false,
    approxCostPerSms: 'LKR 0.35'
  },
  {
    id: 'DIALOG',
    name: 'Dialog Enterprise / Ideamart',
    badge: 'Telco Tier 1',
    description: 'Dialog Axiata Enterprise RichMessage SMS platform. Requires User ID, Password or Bearer Token.',
    docsUrl: 'https://richmessage.dialog.lk',
    defaultSenderId: 'PESTCONTROL',
    requiresPassword: true,
    requiresEndpointUrl: true,
    approxCostPerSms: 'LKR 0.40'
  },
  {
    id: 'MOBITEL',
    name: 'SLT-Mobitel Enterprise SMS',
    badge: 'National Carrier',
    description: 'Mobitel Enterprise SMS / mCash gateway. Requires Service ID / Username and Password.',
    docsUrl: 'https://sms.mobitel.lk',
    defaultSenderId: 'PESTCONTROL',
    requiresPassword: true,
    requiresEndpointUrl: true,
    approxCostPerSms: 'LKR 0.38'
  },
  {
    id: 'SHOUTOUT',
    name: 'ShoutOUT Sri Lanka',
    badge: 'Multi-Channel Cloud',
    description: 'ShoutOUT SMS platform for Sri Lankan enterprises. Requires API Key and registered Sender ID.',
    docsUrl: 'https://getshoutout.com',
    defaultSenderId: 'PESTCONTROL',
    requiresPassword: false,
    requiresEndpointUrl: false,
    approxCostPerSms: 'LKR 0.45'
  },
  {
    id: 'CUSTOM',
    name: 'Custom REST / HTTP Gateway',
    badge: 'Custom URL',
    description: 'Connect any proprietary SMS HTTP gateway with template variables {TO}, {MESSAGE}, {SENDER_ID}.',
    docsUrl: '',
    defaultSenderId: 'PESTCONTROL',
    requiresPassword: false,
    requiresEndpointUrl: true,
    approxCostPerSms: 'Custom'
  }
];

function normalizeSriLankaPhone(phone) {
  if (!phone) {
    return { isValid: false, error: 'Phone number is required' };
  }

  const raw = String(phone).trim();
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('0094')) {
    digits = digits.substring(2);
  }
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '94' + digits.substring(1);
  }
  if (digits.length === 9 && digits.startsWith('7')) {
    digits = '94' + digits;
  }

  const slRegex = /^94(70|71|72|74|75|76|77|78)\d{7}$/;
  if (!slRegex.test(digits)) {
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

async function getSmsSettings() {
  const { data } = await supabase.from('sms_settings').select('*').eq('id', 1).maybeSingle();
  if (!data) {
    const defaultSettings = {
      id: 1,
      provider: 'TEXT_LK',
      sender_id: process.env.TEXT_LK_SENDER_ID || 'TextLKDemo',
      api_token: process.env.TEXT_LK_API_TOKEN || '',
      api_key: '',
      is_simulation: process.env.TEXT_LK_API_TOKEN ? 0 : 1,
      is_active: 1
    };
    await supabase.from('sms_settings').upsert(defaultSettings);
    return defaultSettings;
  }
  return data;
}

async function sendSMS({ to, message, jobId = null, recipientName = null, customBaseUrl = null }) {
  const norm = normalizeSriLankaPhone(to);
  if (!norm.isValid) {
    await supabase.from('sms_logs').insert({
      job_id: jobId,
      phone: to || 'EMPTY',
      recipient_name: recipientName || '',
      message: message || '',
      gateway: 'VALIDATOR',
      status: 'FAILED',
      cost_lkr: 0.0,
      response: norm.error
    });
    return { success: false, error: norm.error, phone: to };
  }

  const settings = await getSmsSettings();
  const phone = norm.normalized;
  const isSimulation = Boolean(settings.is_simulation);
  const textLkToken = String(settings.api_token || settings.api_key || process.env.TEXT_LK_API_TOKEN || '').trim();
  const senderId = String(settings.sender_id || 'TextLKDemo').trim();

  // Live Text.lk dispatch
  if (!isSimulation && (settings.provider === 'TEXT_LK' || textLkToken)) {
    try {
      const response = await fetch('https://app.text.lk/api/v3/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${textLkToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          recipient: phone,
          sender_id: senderId,
          message: message
        })
      });

      const resText = await response.text();
      let resJson;
      try { resJson = JSON.parse(resText); } catch { resJson = { raw: resText }; }

      const isOk = response.ok && (!resJson.status || resJson.status === 'success' || resJson.status === 'queued');

      await supabase.from('sms_logs').insert({
        job_id: jobId,
        phone,
        recipient_name: recipientName || '',
        message,
        gateway: 'TEXT_LK',
        status: isOk ? 'SENT' : 'FAILED',
        cost_lkr: isOk ? 0.35 : 0.0,
        response: resText
      });

      if (!isOk) {
        return {
          success: false,
          error: resJson.message || `Text.lk delivery failed (HTTP ${response.status})`,
          phone,
          details: resJson
        };
      }

      return {
        success: true,
        simulated: false,
        messageId: resJson.data?.uid || resJson.uid || `TEXTLK-${Date.now()}`,
        phone,
        formattedPhone: norm.nationalFormat,
        operator: norm.operator,
        provider: 'TEXT_LK',
        costLkr: 0.35
      };
    } catch (err) {
      await supabase.from('sms_logs').insert({
        job_id: jobId,
        phone,
        recipient_name: recipientName || '',
        message,
        gateway: 'TEXT_LK',
        status: 'FAILED',
        cost_lkr: 0.0,
        response: err.message
      });
      return { success: false, error: err.message, phone };
    }
  }

  // Simulation mode: records cleanly in database with SIMULATED status
  const simMessageId = `SIM-LK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  await supabase.from('sms_logs').insert({
    job_id: jobId,
    phone,
    recipient_name: recipientName || '',
    message,
    gateway: settings.provider || 'SIMULATOR',
    status: 'SIMULATED',
    cost_lkr: 0.35,
    response: JSON.stringify({ messageId: simMessageId, simulated: true, notice: 'Simulated mode enabled in SMS settings' })
  });

  return {
    success: true,
    simulated: true,
    messageId: simMessageId,
    phone,
    formattedPhone: norm.nationalFormat,
    operator: norm.operator,
    provider: settings.provider || 'SIMULATOR',
    costLkr: 0.35,
    message: `[Simulated] Dispatched to ${norm.nationalFormat} (${norm.operator})`
  };
}

function build24hReminderMessage(job, systemUrl = 'https://one-pest.vercel.app') {
  const clientName = job.contact_person || job.customer_name || 'Valued Customer';
  const treatment = job.treatment_code || 'Pest Control';
  const date = job.scheduled_date || 'tomorrow';
  const time = job.scheduled_time || '09:00 AM';
  const tech = job.technician_name || 'Field Specialist';
  const loc = job.location_name || 'your premises';
  const confirmUrl = `${systemUrl.replace(/\/$/, '')}/confirmations/${job.job_code}`;

  return `PestControl Pro: Reminder that your ${treatment} service is scheduled for ${date} at ${time} (${loc}). Specialist: ${tech}. To confirm or reschedule: ${confirmUrl} or Call 011-2345678`;
}

function buildArrivalReminderMessage(job) {
  const tech = job.technician_name || 'Field Specialist';
  const treatment = job.treatment_code || 'Pest Control';
  const time = job.scheduled_time || 'today';

  return `PestControl Pro: Our specialist ${tech} is en-route for your scheduled ${treatment} service today at approx ${time}. Thank you for choosing PestControl Pro! Hotline: 011-2345678`;
}

function buildTechDispatchMessage(job, systemUrl = 'https://one-pest.vercel.app') {
  const techName = job.technician_name || 'Specialist';
  const customerName = job.customer_name || 'Client';
  const treatment = job.treatment_code || 'Service';
  const date = job.scheduled_date || 'Today';
  const time = job.scheduled_time || '09:00';
  const loc = job.location_name || job.location_address || 'Premises';
  const jobUrl = `${systemUrl.replace(/\/$/, '')}/tech?job=${job.id}`;

  return `PestControl: Hello ${techName}, Job #${job.job_code} assigned for ${customerName} on ${date} at ${time} (${treatment} @ ${loc}). Tap link to start work: ${jobUrl}`;
}

module.exports = {
  OPERATOR_PREFIXES,
  AVAILABLE_PROVIDERS,
  normalizeSriLankaPhone,
  getSmsSettings,
  sendSMS,
  build24hReminderMessage,
  buildArrivalReminderMessage,
  buildTechDispatchMessage
};
