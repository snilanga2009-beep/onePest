const express = require('express');
const router = express.Router();
const db = require('../db');
const { formatDateColombo } = require('../services/recurringEngine');
const {
  getSmsSettings,
  normalizeSriLankaPhone,
  build24hReminderMessage,
  buildArrivalReminderMessage
} = require('../services/smsGateway');

/**
 * Format Sri Lanka phone number for WhatsApp (e.g. 0771234567 -> 94771234567)
 */
function formatWhatsAppPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('94') && digits.length >= 11) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '94' + digits.substring(1);
  if (digits.length === 9) return '94' + digits;
  return digits;
}

// Get Reminder Queue (Upcoming tomorrow, Today, and Overdue jobs)
router.get('/queue', (req, res) => {
  const today = formatDateColombo(new Date());

  const tomorrowObj = new Date(today);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrow = formatDateColombo(tomorrowObj);
  const smsSettings = getSmsSettings();

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || 'localhost:5000';
  const baseUrl = smsSettings.system_url && smsSettings.system_url.trim()
    ? smsSettings.system_url.trim().replace(/\/$/, '')
    : `${protocol}://${host}`;

  // Tomorrow's jobs needing 24-hour reminder
  const tomorrowJobs = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.contact_person,
           l.location_name, l.address as location_address,
           t.code as treatment_code, t.name as treatment_name,
           tech.full_name as technician_name, tech.phone as technician_phone
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    WHERE j.scheduled_date = ? AND j.status IN ('TO_BE_DONE', 'ASSIGNED', 'CONFIRMED')
    ORDER BY j.scheduled_time ASC
  `).all(tomorrow);

  // Today's jobs needing same-day arrival reminder
  const todayJobs = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.contact_person,
           l.location_name, l.address as location_address,
           t.code as treatment_code, t.name as treatment_name,
           tech.full_name as technician_name, tech.phone as technician_phone
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    WHERE j.scheduled_date = ? AND j.status IN ('TO_BE_DONE', 'ASSIGNED', 'IN_PROGRESS')
    ORDER BY j.scheduled_time ASC
  `).all(today);

  // Overdue jobs needing follow-up
  const overdueJobs = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.contact_person,
           l.location_name,
           t.code as treatment_code,
           tech.full_name as technician_name
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    WHERE j.scheduled_date < ? AND j.status IN ('TO_BE_DONE', 'ASSIGNED', 'CONFIRMED')
    ORDER BY j.scheduled_date DESC
    LIMIT 15
  `).all(today);

  // Technicians with active jobs today
  const techniciansWithRoutes = db.prepare(`
    SELECT DISTINCT tech.id, tech.full_name, tech.phone, COUNT(j.id) as total_jobs
    FROM jobs j
    JOIN staff tech ON j.technician_id = tech.id
    WHERE j.scheduled_date = ? AND j.status != 'CANCELLED'
    GROUP BY tech.id
  `).all(today);

  res.json({
    success: true,
    today,
    tomorrow,
    counts: {
      tomorrow_reminders: tomorrowJobs.length,
      today_reminders: todayJobs.length,
      overdue_followups: overdueJobs.length,
      active_technicians: techniciansWithRoutes.length
    },
    system_base_url: baseUrl,
    tomorrow_jobs: tomorrowJobs.map(j => {
      const norm = normalizeSriLankaPhone(j.customer_phone);
      return {
        ...j,
        whatsapp_phone: formatWhatsAppPhone(j.customer_phone),
        whatsapp_message: `Hello ${j.contact_person || j.customer_name}, this is a reminder from PestControl Pro that your scheduled ${j.treatment_code} service is set for tomorrow, ${j.scheduled_date} at ${j.scheduled_time || '09:00 AM'} at ${j.location_name || 'your premises'}. Assigned Specialist: ${j.technician_name || 'Field Specialist'}. Reply YES to confirm or click: ${baseUrl}/confirmations/${j.job_code}`,
        sms_phone: norm.isValid ? norm.normalized : null,
        sms_formatted: norm.isValid ? norm.nationalFormat : null,
        sms_operator: norm.isValid ? norm.operator : null,
        sms_is_valid: norm.isValid,
        sms_message: build24hReminderMessage(j, baseUrl)
      };
    }),
    today_jobs: todayJobs.map(j => {
      const norm = normalizeSriLankaPhone(j.customer_phone);
      return {
        ...j,
        whatsapp_phone: formatWhatsAppPhone(j.customer_phone),
        whatsapp_message: `Good day ${j.contact_person || j.customer_name}, our pest control technician ${j.technician_name || 'on duty'} is scheduled to arrive today around ${j.scheduled_time || '09:00 AM'} for your ${j.treatment_code} treatment. Thank you for choosing PestControl Pro!`,
        sms_phone: norm.isValid ? norm.normalized : null,
        sms_formatted: norm.isValid ? norm.nationalFormat : null,
        sms_operator: norm.isValid ? norm.operator : null,
        sms_is_valid: norm.isValid,
        sms_message: buildArrivalReminderMessage(j)
      };
    }),
    overdue_jobs: overdueJobs,
    technicians_routes: techniciansWithRoutes,
    sms_settings: {
      provider: smsSettings.provider,
      sender_id: smsSettings.sender_id,
      is_simulation: Boolean(smsSettings.is_simulation),
      is_active: Boolean(smsSettings.is_active)
    }
  });
});

// Generate Technician Route Summary for WhatsApp
router.get('/technician-route/:techId', (req, res) => {
  const { techId } = req.params;
  const today = formatDateColombo(new Date());

  const tech = db.prepare('SELECT * FROM staff WHERE id = ?').get(techId);
  if (!tech) return res.status(404).json({ success: false, error: 'Technician not found' });

  const jobs = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone,
           l.location_name, l.address as location_address,
           t.code as treatment_code
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    WHERE j.technician_id = ? AND j.scheduled_date = ? AND j.status != 'CANCELLED'
    ORDER BY j.scheduled_time ASC
  `).all(techId, today);

  let message = `Good morning ${tech.full_name}! Here is your pest control service schedule for today (${today}):\n\n`;
  jobs.forEach((j, i) => {
    message += `${i + 1}. [${j.scheduled_time || '09:00'}] ${j.customer_name} (${j.treatment_code})\n`;
    message += `   📍 Location: ${j.location_name || j.location_address || 'Main'}\n`;
    message += `   📞 Client Phone: ${j.customer_phone || 'N/A'}\n`;
    message += `   Status: ${j.status}\n\n`;
  });
  message += `Open your mobile app to navigate and start each job: http://localhost:5000`;

  res.json({
    success: true,
    technician: tech,
    date: today,
    jobCount: jobs.length,
    whatsapp_phone: formatWhatsAppPhone(tech.phone),
    whatsapp_message: message,
    jobs
  });
});

// Log a sent reminder
router.post('/log-sent', (req, res) => {
  const { job_id, channel, recipient_name, recipient_phone } = req.body;
  try {
    db.prepare(`
      INSERT INTO job_logs (job_id, action, notes)
      VALUES (?, 'REMINDER_SENT', ?)
    `).run(job_id, `Automated reminder sent via ${channel || 'WhatsApp'} to ${recipient_name} (${recipient_phone})`);

    res.json({ success: true, message: 'Reminder dispatch recorded' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
