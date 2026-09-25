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

async function dispatchToProvider(settings, toPhone, messageText) {
  const provider = settings.provider || 'TEXT_LK';
  let senderId = String(settings.sender_id || 'TextLKDemo').trim();

  switch (provider) {
    case 'TEXT_LK': {
      let url = (settings.endpoint_url && settings.endpoint_url.startsWith('http'))
        ? String(settings.endpoint_url).trim()
        : 'https://app.text.lk/api/v3/sms/send';

      if (!url.includes('/sms/send')) {
        url = url.replace(/\/+$/, '') + '/sms/send';
      }

      const token = String(settings.api_key || settings.api_token || process.env.TEXT_LK_API_TOKEN || '').trim();
      if (!token) {
        throw new Error('Text.lk requires an API Token. Check SMS Gateway Settings.');
      }

      if (senderId.toUpperCase() === 'TEXTLKDEMO') {
        senderId = 'TextLKDemo';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          recipient: toPhone,
          sender_id: senderId,
          type: 'plain',
          message: messageText
        })
      });

      const resText = await response.text();
      let data;
      try { data = JSON.parse(resText); } catch { data = { raw: resText }; }

      if (!response.ok || data.status === 'error' || data.status === 'failed') {
        let errMsg = data.message || (data.errors ? Object.values(data.errors).flat().join(', ') : `Text.lk HTTP error ${response.status}`);
        if (errMsg === 'Failed' || response.status === 403) {
          errMsg = `Text.lk rejected dispatch. Sender ID "${senderId}" may need approval, or check token.`;
        }
        throw new Error(errMsg);
      }

      return {
        messageId: data.data?.uid || data.data?.id || data.uid || `TEXTLK-${Date.now()}`,
        cost: Number(data.data?.cost || 0.35),
        rawResponse: data,
        resText
      };
    }

    case 'NOTIFY_LK': {
      const url = (settings.endpoint_url && settings.endpoint_url.startsWith('http'))
        ? settings.endpoint_url
        : 'https://app.notify.lk/api/v1/send';

      const userId = String(settings.user_id || '').trim();
      const apiKey = String(settings.api_key || settings.api_token || '').trim();
      if (!userId || !apiKey) {
        throw new Error('Notify.lk requires both User ID and API Key. Check SMS Gateway Settings.');
      }

      const params = new URLSearchParams({
        user_id: userId,
        api_key: apiKey,
        sender_id: senderId,
        to: toPhone,
        message: messageText
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      const resText = await response.text();
      let data;
      try { data = JSON.parse(resText); } catch { data = { raw: resText }; }

      if (!response.ok || data.status === 'error') {
        const errDetail = data.errors ? Object.values(data.errors).flat().join(', ') : data.message;
        throw new Error(errDetail || `Notify.lk HTTP error ${response.status}`);
      }

      return {
        messageId: data.data?.message_id || data.message_id || `NOTIFY-${Date.now()}`,
        cost: 0.35,
        rawResponse: data,
        resText
      };
    }

    case 'DIALOG': {
      const url = settings.endpoint_url || 'https://richmessage.dialog.lk/api/sms/send';
      const authHeader = settings.api_token
        ? `Bearer ${settings.api_token.trim()}`
        : settings.user_id && settings.password
        ? `Basic ${Buffer.from(`${settings.user_id.trim()}:${settings.password.trim()}`).toString('base64')}`
        : settings.api_key ? `ApiKey ${settings.api_key.trim()}` : '';

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

      const resText = await response.text();
      let data;
      try { data = JSON.parse(resText); } catch { data = { raw: resText }; }

      if (!response.ok) {
        throw new Error(data.errorMessage || data.message || `Dialog HTTP error ${response.status}`);
      }

      return {
        messageId: data.transactionId || data.messageId || `DIALOG-${Date.now()}`,
        cost: 0.40,
        rawResponse: data,
        resText
      };
    }

    case 'MOBITEL': {
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

      const resText = await response.text();
      let data;
      try { data = JSON.parse(resText); } catch { data = { raw: resText }; }

      if (!response.ok) {
        throw new Error(data.error || `Mobitel HTTP error ${response.status}`);
      }

      return {
        messageId: data.id || `MOBITEL-${Date.now()}`,
        cost: 0.38,
        rawResponse: data,
        resText
      };
    }

    case 'SHOUTOUT': {
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
          'Authorization': `ApiKey ${String(settings.api_key || '').trim()}`
        },
        body: JSON.stringify(body)
      });

      const resText = await response.text();
      let data;
      try { data = JSON.parse(resText); } catch { data = { raw: resText }; }

      if (!response.ok) {
        throw new Error(data.message || `ShoutOUT HTTP error ${response.status}`);
      }

      return {
        messageId: data.id || `SHOUTOUT-${Date.now()}`,
        cost: 0.45,
        rawResponse: data,
        resText
      };
    }

    case 'CUSTOM': {
      let customUrl = settings.endpoint_url || '';
      if (!customUrl) {
        throw new Error('Custom Gateway requires a valid Endpoint URL in SMS settings');
      }

      customUrl = customUrl
        .replace('{TO}', encodeURIComponent(toPhone))
        .replace('{MESSAGE}', encodeURIComponent(messageText))
        .replace('{SENDER_ID}', encodeURIComponent(senderId))
        .replace('{API_KEY}', encodeURIComponent(String(settings.api_key || '').trim()))
        .replace('{USER_ID}', encodeURIComponent(String(settings.user_id || '').trim()));

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
        rawResponse: parsed,
        resText: text
      };
    }

    default:
      throw new Error(`Unsupported SMS provider: ${provider}`);
  }
}

async function sendSMS(arg1, arg2, arg3) {
  let to, message, jobId = null, recipientName = null;

  if (typeof arg1 === 'object' && arg1 !== null && (!arg2 || typeof arg2 !== 'string')) {
    to = arg1.to || arg1.phone || arg1.normalized;
    message = arg1.message || arg1.text;
    jobId = arg1.jobId || arg1.job_id || null;
    recipientName = arg1.recipientName || arg1.recipient_name || '';
  } else {
    to = typeof arg1 === 'object' && arg1 !== null ? (arg1.normalized || arg1.digits || arg1.phone) : arg1;
    message = arg2;
    if (typeof arg3 === 'object' && arg3 !== null) {
      jobId = arg3.jobId || arg3.job_id || null;
      recipientName = arg3.recipientName || arg3.recipient_name || '';
    }
  }

  const norm = normalizeSriLankaPhone(to);
  if (!norm.isValid) {
    const errText = norm.error || `Invalid Sri Lankan phone number: "${to}"`;
    try {
      await supabase.from('sms_logs').insert({
        job_id: jobId,
        phone: to || 'EMPTY',
        recipient_name: recipientName || '',
        message: message || '',
        gateway: 'VALIDATOR',
        status: 'FAILED',
        cost_lkr: 0.0,
        response: errText
      });
    } catch (e) {
      console.warn('[SMS Log Fail]:', e.message);
    }
    return {
      success: false,
      error: errText,
      message: errText,
      phone: to
    };
  }

  const settings = await getSmsSettings();
  const phone = norm.normalized;
  const isSimulation = Boolean(settings.is_simulation);

  // Live Carrier Dispatch
  if (!isSimulation) {
    try {
      const dispatchRes = await dispatchToProvider(settings, phone, message);

      try {
        await supabase.from('sms_logs').insert({
          job_id: jobId,
          phone,
          recipient_name: recipientName || '',
          message,
          gateway: settings.provider || 'TEXT_LK',
          status: 'SENT',
          cost_lkr: dispatchRes.cost || 0.35,
          response: typeof dispatchRes.rawResponse === 'object' ? JSON.stringify(dispatchRes.rawResponse) : String(dispatchRes.resText || '')
        });
      } catch (logErr) {
        console.warn('[SMS DB Log Error]:', logErr.message);
      }

      return {
        success: true,
        simulated: false,
        messageId: dispatchRes.messageId,
        phone,
        formattedPhone: norm.nationalFormat,
        operator: norm.operator,
        provider: settings.provider || 'TEXT_LK',
        costLkr: dispatchRes.cost || 0.35,
        message: `SMS reminder dispatched to ${norm.nationalFormat} (${norm.operator}) via ${settings.provider || 'Gateway'}`
      };
    } catch (err) {
      try {
        await supabase.from('sms_logs').insert({
          job_id: jobId,
          phone,
          recipient_name: recipientName || '',
          message,
          gateway: settings.provider || 'TEXT_LK',
          status: 'FAILED',
          cost_lkr: 0.0,
          response: err.message
        });
      } catch (logErr) {
        console.warn('[SMS DB Log Error]:', logErr.message);
      }

      return {
        success: false,
        error: err.message,
        message: `SMS delivery failed: ${err.message}`,
        phone
      };
    }
  }

  // Simulation Mode
  const simMessageId = `SIM-LK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  try {
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
  } catch (e) {
    console.warn('[SMS DB Log Error]:', e.message);
  }

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
