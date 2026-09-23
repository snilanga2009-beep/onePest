const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  getSmsSettings,
  updateSmsSettings,
  normalizeSriLankaPhone,
  sendSMS,
  build24hReminderMessage,
  buildArrivalReminderMessage,
  buildTechDispatchMessage
} = require('../services/smsGateway');
const { formatDateColombo } = require('../services/recurringEngine');

// Available gateways documentation & metadata for the UI
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

// GET SMS Settings & Provider Metadata
router.get('/settings', (req, res) => {
  try {
    const settings = getSmsSettings();

    // Calculate quick stats from logs
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_dispatched,
        SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as total_sent,
        SUM(CASE WHEN status = 'SIMULATED' THEN 1 ELSE 0 END) as total_simulated,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as total_failed,
        COALESCE(SUM(cost_lkr), 0.0) as total_cost_lkr
      FROM sms_logs
    `).get();

    res.json({
      success: true,
      settings,
      providers: AVAILABLE_PROVIDERS,
      stats: {
        total_dispatched: stats.total_dispatched || 0,
        total_sent: stats.total_sent || 0,
        total_simulated: stats.total_simulated || 0,
        total_failed: stats.total_failed || 0,
        total_cost_lkr: Number((stats.total_cost_lkr || 0).toFixed(2))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Update SMS Settings
router.post('/settings', (req, res) => {
  try {
    const updated = updateSmsSettings(req.body);
    res.json({
      success: true,
      message: 'SMS Gateway settings updated successfully',
      settings: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Validate Sri Lankan Phone Number
router.post('/validate-phone', (req, res) => {
  const { phone } = req.body;
  const result = normalizeSriLankaPhone(phone);
  res.json({ success: true, ...result });
});

// POST Send Test SMS
router.post('/send-test', async (req, res) => {
  const { to, message } = req.body;
  if (!to) {
    return res.status(400).json({ success: false, error: 'Recipient phone number is required' });
  }

  const msg = message || 'PestControl Pro: This is a test SMS verification from your Master Scheduling System.';
  const result = await sendSMS({
    to,
    message: msg,
    recipientName: 'Test Recipient'
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({
    success: true,
    message: result.simulated
      ? `Simulated test SMS successfully recorded for ${result.formattedPhone || to}`
      : `Test SMS dispatched successfully to ${result.formattedPhone || to}`,
    details: result
  });
});

// POST Send Reminder for a specific Job
router.post('/send-job-reminder', async (req, res) => {
  const { job_id, reminder_type = '24H' } = req.body; // '24H' or 'ARRIVAL' or 'CUSTOM'

  if (!job_id) {
    return res.status(400).json({ success: false, error: 'job_id is required' });
  }

  try {
    const job = db.prepare(`
      SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.contact_person,
             l.location_name, l.address as location_address,
             t.code as treatment_code, t.name as treatment_name,
             tech.full_name as technician_name, tech.phone as technician_phone
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      LEFT JOIN customer_locations l ON j.location_id = l.id
      JOIN treatments t ON j.treatment_id = t.id
      LEFT JOIN staff tech ON j.technician_id = tech.id
      WHERE j.id = ?
    `).get(job_id);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (!job.customer_phone) {
      return res.status(400).json({ success: false, error: 'Customer has no phone number on record' });
    }

    let messageText;
    if (reminder_type === 'ARRIVAL') {
      messageText = buildArrivalReminderMessage(job);
    } else {
      messageText = build24hReminderMessage(job);
    }

    const result = await sendSMS({
      to: job.customer_phone,
      message: messageText,
      jobId: job.id,
      recipientName: job.customer_name
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: result.simulated
        ? `Simulated SMS reminder logged for ${job.customer_name}`
        : `SMS reminder dispatched to ${job.customer_name}`,
      details: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Send Job Start Link & SMS Dispatch to Technician
router.post('/send-tech-dispatch', async (req, res) => {
  const { job_id, technician_phone, technician_name, custom_base_url } = req.body;

  if (!job_id) {
    return res.status(400).json({ success: false, error: 'job_id is required' });
  }

  try {
    const job = db.prepare(`
      SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.contact_person,
             l.location_name, l.address as location_address,
             t.code as treatment_code, t.name as treatment_name,
             tech.full_name as technician_name, tech.phone as technician_phone
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      LEFT JOIN customer_locations l ON j.location_id = l.id
      JOIN treatments t ON j.treatment_id = t.id
      LEFT JOIN staff tech ON j.technician_id = tech.id
      WHERE j.id = ?
    `).get(job_id);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const recipientPhone = technician_phone || job.technician_phone;
    if (!recipientPhone) {
      return res.status(400).json({
        success: false,
        error: 'No phone number provided or registered for the assigned technician'
      });
    }

    const techRecipientName = technician_name || job.technician_name || 'Technician';
    const settings = getSmsSettings();
    const baseUrl = (custom_base_url || settings.system_url || 'http://localhost:5000').replace(/\/$/, '');
    const jobUrl = `${baseUrl}/tech?job=${job.id}`;

    const messageText = buildTechDispatchMessage({
      ...job,
      technician_name: techRecipientName
    }, baseUrl);

    const result = await sendSMS({
      to: recipientPhone,
      message: messageText,
      jobId: job.id,
      recipientName: techRecipientName
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: result.simulated
        ? `Simulated Technician SMS dispatch logged for ${techRecipientName} (${result.formattedPhone || recipientPhone})`
        : `Job start link SMS sent to ${techRecipientName} (${result.formattedPhone || recipientPhone})`,
      jobUrl,
      recipientPhone,
      recipientName: techRecipientName,
      messageText,
      details: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Bulk Send Reminders (e.g. all tomorrow's upcoming jobs)
router.post('/bulk-send', async (req, res) => {
  const { date, reminder_type = '24H', job_ids = null } = req.body;

  try {
    let jobsToRemind = [];

    if (Array.isArray(job_ids) && job_ids.length > 0) {
      const placeholders = job_ids.map(() => '?').join(',');
      jobsToRemind = db.prepare(`
        SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.contact_person,
               l.location_name,
               t.code as treatment_code,
               tech.full_name as technician_name
        FROM jobs j
        JOIN customers c ON j.customer_id = c.id
        LEFT JOIN customer_locations l ON j.location_id = l.id
        JOIN treatments t ON j.treatment_id = t.id
        LEFT JOIN staff tech ON j.technician_id = tech.id
        WHERE j.id IN (${placeholders})
      `).all(...job_ids);
    } else {
      // Default to tomorrow's date
      let targetDate = date;
      if (!targetDate) {
        const tomorrowObj = new Date();
        tomorrowObj.setDate(tomorrowObj.getDate() + 1);
        targetDate = formatDateColombo(tomorrowObj);
      }

      jobsToRemind = db.prepare(`
        SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.contact_person,
               l.location_name,
               t.code as treatment_code,
               tech.full_name as technician_name
        FROM jobs j
        JOIN customers c ON j.customer_id = c.id
        LEFT JOIN customer_locations l ON j.location_id = l.id
        JOIN treatments t ON j.treatment_id = t.id
        LEFT JOIN staff tech ON j.technician_id = tech.id
        WHERE j.scheduled_date = ? AND j.status IN ('TO_BE_DONE', 'ASSIGNED', 'CONFIRMED')
      `).all(targetDate);
    }

    if (jobsToRemind.length === 0) {
      return res.json({
        success: true,
        message: 'No jobs found to send reminders to for the selected criteria.',
        summary: { total: 0, sent: 0, simulated: 0, failed: 0 }
      });
    }

    const summary = {
      total: jobsToRemind.length,
      sent: 0,
      simulated: 0,
      failed: 0,
      details: []
    };

    for (const job of jobsToRemind) {
      if (!job.customer_phone) {
        summary.failed++;
        summary.details.push({
          job_id: job.id,
          customer: job.customer_name,
          status: 'SKIPPED',
          reason: 'No phone number'
        });
        continue;
      }

      const messageText = reminder_type === 'ARRIVAL'
        ? buildArrivalReminderMessage(job)
        : build24hReminderMessage(job);

      const resSMS = await sendSMS({
        to: job.customer_phone,
        message: messageText,
        jobId: job.id,
        recipientName: job.customer_name
      });

      if (resSMS.success) {
        if (resSMS.simulated) {
          summary.simulated++;
        } else {
          summary.sent++;
        }
        summary.details.push({
          job_id: job.id,
          customer: job.customer_name,
          phone: resSMS.phone,
          status: resSMS.simulated ? 'SIMULATED' : 'SENT',
          messageId: resSMS.messageId
        });
      } else {
        summary.failed++;
        summary.details.push({
          job_id: job.id,
          customer: job.customer_name,
          phone: job.customer_phone,
          status: 'FAILED',
          reason: resSMS.error
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk reminder dispatch completed: ${summary.sent + summary.simulated} dispatched (${summary.simulated} simulated, ${summary.sent} live), ${summary.failed} failed/skipped.`,
      summary
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Recent SMS Logs
router.get('/logs', (req, res) => {
  const { limit = 50, status } = req.query;
  try {
    let query = `
      SELECT l.*, j.job_code
      FROM sms_logs l
      LEFT JOIN jobs j ON l.job_id = j.id
    `;
    const params = [];

    if (status) {
      query += ` WHERE l.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY l.created_at DESC LIMIT ?`;
    params.push(Number(limit));

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
