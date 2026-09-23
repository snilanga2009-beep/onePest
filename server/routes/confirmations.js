const express = require('express');
const router = express.Router();
const db = require('../db');

// Get appointment details for customer confirmation page
router.get('/:jobCode', (req, res) => {
  const { jobCode } = req.params;

  const job = db.prepare(`
    SELECT j.id, j.job_code, j.scheduled_date, j.scheduled_time, j.duration_minutes,
           j.status, j.customer_confirmation_status, j.reschedule_reason,
           c.name as customer_name, c.contact_person, c.phone as customer_phone,
           l.location_name, l.address as location_address,
           t.code as treatment_code, t.name as treatment_name, t.description as treatment_description,
           tech.full_name as technician_name, tech.phone as technician_phone
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    WHERE j.job_code = ? OR j.id = ?
  `).get(jobCode, jobCode);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Appointment not found' });
  }

  res.json({ success: true, appointment: job });
});

// Customer confirms appointment
router.post('/:jobCode/confirm', (req, res) => {
  const { jobCode } = req.params;

  try {
    const job = db.prepare('SELECT id, job_code, customer_id FROM jobs WHERE job_code = ? OR id = ?').get(jobCode, jobCode);
    if (!job) return res.status(404).json({ success: false, error: 'Appointment not found' });

    db.prepare(`
      UPDATE jobs SET
        customer_confirmation_status = 'CONFIRMED',
        status = CASE WHEN status = 'TO_BE_DONE' THEN 'CONFIRMED' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(job.id);

    db.prepare('INSERT INTO job_logs (job_id, action, notes) VALUES (?, ?, ?)').run(
      job.id, 'CUSTOMER_CONFIRMED', 'Customer confirmed appointment via online link'
    );

    // Create notification for supervisor
    db.prepare(`
      INSERT INTO notifications (title, message, type, job_id, target_role)
      VALUES (?, ?, 'CONFIRMATION', ?, 'SUPERVISOR')
    `).run('Customer Confirmed Appointment', `Job ${job.job_code} confirmed by customer`, job.id);

    res.json({ success: true, message: 'Appointment confirmed successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Customer requests reschedule
router.post('/:jobCode/reschedule', (req, res) => {
  const { jobCode } = req.params;
  const { preferred_date, preferred_time, reason } = req.body;

  try {
    const job = db.prepare('SELECT id, job_code FROM jobs WHERE job_code = ? OR id = ?').get(jobCode, jobCode);
    if (!job) return res.status(404).json({ success: false, error: 'Appointment not found' });

    const reasonNote = `Customer requested reschedule to ${preferred_date || 'flexible date'} at ${preferred_time || 'flexible time'}. Note: ${reason || 'None'}`;

    db.prepare(`
      UPDATE jobs SET
        customer_confirmation_status = 'RESCHEDULE_REQUESTED',
        reschedule_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reasonNote, job.id);

    db.prepare('INSERT INTO job_logs (job_id, action, notes) VALUES (?, ?, ?)').run(
      job.id, 'RESCHEDULE_REQUESTED', reasonNote
    );

    // Create notification for admin/supervisor
    db.prepare(`
      INSERT INTO notifications (title, message, type, job_id, target_role)
      VALUES (?, ?, 'RESCHEDULE', ?, 'MANAGER')
    `).run('Reschedule Request Received', `Job ${job.job_code}: ${reasonNote}`, job.id);

    res.json({ success: true, message: 'Reschedule request submitted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
