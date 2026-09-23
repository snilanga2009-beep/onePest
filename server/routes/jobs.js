const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateJobCode, handleJobCompletion, formatDateColombo } = require('../services/recurringEngine');
const { sendSMS, buildTechDispatchMessage, getSmsSettings } = require('../services/smsGateway');
const {
  notifyJobAssigned,
  notifyJobUpdated,
  notifyJobCancelled,
  notifyJobPostponed
} = require('../services/pushNotificationService');

/**
 * Helper to dispatch unexpiring job start link via SMS to assigned technician
 */
async function dispatchTechSmsIfAssigned(jobId, techId, customUrl) {
  if (!techId) return null;
  try {
    const tech = db.prepare('SELECT * FROM staff WHERE id = ?').get(techId);
    if (!tech || !tech.phone) {
      console.warn(`[SMS Dispatch] Tech #${techId} has no phone number configured.`);
      return { success: false, error: 'Technician has no phone number' };
    }

    const job = db.prepare(`
      SELECT j.*,
             COALESCE(c.name, 'Customer') as customer_name,
             c.phone as customer_phone,
             l.location_name,
             l.address as location_address,
             COALESCE(t.code, 'TREATMENT') as treatment_code
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN customer_locations l ON j.location_id = l.id
      LEFT JOIN treatments t ON j.treatment_id = t.id
      WHERE j.id = ?
    `).get(jobId);

    if (!job) {
      console.warn(`[SMS Dispatch] Job #${jobId} not found.`);
      return { success: false, error: 'Job not found' };
    }

    const settings = getSmsSettings();
    const baseUrl = (customUrl || settings.system_url || 'http://localhost:5000').replace(/\/$/, '');
    const messageText = buildTechDispatchMessage({ ...job, technician_name: tech.full_name }, baseUrl);

    console.log(`[SMS Dispatch] Auto-sending job link SMS to ${tech.full_name} (${tech.phone}) for Job #${job.job_code}`);
    const smsRes = await sendSMS({
      to: tech.phone,
      message: messageText,
      jobId: job.id,
      recipientName: tech.full_name
    });

    console.log(`[SMS Dispatch] Result for Job #${job.job_code}:`, JSON.stringify(smsRes));
    return smsRes;
  } catch (err) {
    console.error(`Auto dispatch SMS error for Job #${jobId}:`, err.message);
    return { success: false, error: err.message };
  }
}

// List jobs with query filters
router.get('/', (req, res) => {
  const {
    date, from_date, to_date, status, technician_id,
    customer_id, treatment_id, search, limit = 100, page = 1
  } = req.query;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const whereClauses = ['1=1'];
  const params = [];

  if (date) {
    whereClauses.push('j.scheduled_date = ?');
    params.push(date);
  }
  if (from_date) {
    whereClauses.push('j.scheduled_date >= ?');
    params.push(from_date);
  }
  if (to_date) {
    whereClauses.push('j.scheduled_date <= ?');
    params.push(to_date);
  }
  if (status) {
    whereClauses.push('j.status = ?');
    params.push(status.toUpperCase());
  }
  if (technician_id) {
    whereClauses.push('j.technician_id = ?');
    params.push(technician_id);
  }
  if (customer_id) {
    whereClauses.push('j.customer_id = ?');
    params.push(customer_id);
  }
  if (treatment_id) {
    whereClauses.push('j.treatment_id = ?');
    params.push(treatment_id);
  }
  if (search) {
    whereClauses.push(`(
      j.job_code LIKE ? OR
      c.name LIKE ? OR
      c.phone LIKE ? OR
      l.location_name LIKE ? OR
      t.code LIKE ?
    )`);
    const q = `%${search}%`;
    params.push(q, q, q, q, q);
  }

  const whereSql = whereClauses.join(' AND ');

  const total = db.prepare(`
    SELECT COUNT(*) as count 
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    WHERE ${whereSql}
  `).get(...params).count;

  const jobs = db.prepare(`
    SELECT j.*,
           c.name as customer_name, c.customer_code, c.phone as customer_phone,
           c.contact_person, c.special_instructions,
           l.location_name, l.address as location_address, l.latitude, l.longitude,
           t.code as treatment_code, t.name as treatment_name, t.color_hex as treatment_color,
           tech.full_name as technician_name, tech.phone as technician_phone,
           sales.full_name as salesman_name,
           r.frequency as recurring_frequency
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    LEFT JOIN staff sales ON j.salesman_id = sales.id
    LEFT JOIN recurring_services r ON j.recurring_service_id = r.id
    WHERE ${whereSql}
    ORDER BY j.scheduled_date ASC, j.scheduled_time ASC, j.id ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), offset);

  res.json({
    success: true,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    jobs
  });
});

// Get job details with photos and logs
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const job = db.prepare(`
    SELECT j.*,
           c.name as customer_name, c.customer_code, c.phone as customer_phone,
           c.contact_person, c.address as customer_address, c.special_instructions,
           l.location_name, l.address as location_address, l.latitude, l.longitude,
           t.code as treatment_code, t.name as treatment_name, t.color_hex as treatment_color,
           tech.full_name as technician_name, tech.phone as technician_phone,
           sales.full_name as salesman_name,
           r.frequency as recurring_frequency, r.preferred_day, r.preferred_time
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    LEFT JOIN staff sales ON j.salesman_id = sales.id
    LEFT JOIN recurring_services r ON j.recurring_service_id = r.id
    WHERE j.id = ?
  `).get(id);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  const photos = db.prepare('SELECT * FROM job_photos WHERE job_id = ? ORDER BY created_at ASC').all(id);
  const logs = db.prepare(`
    SELECT l.*, s.full_name as performed_by_name
    FROM job_logs l
    LEFT JOIN staff s ON l.performed_by_id = s.id
    WHERE l.job_id = ?
    ORDER BY l.timestamp DESC
  `).all(id);

  res.json({ success: true, job, photos, logs });
});

// Create manual/ad-hoc job
router.post('/', async (req, res) => {
  const {
    customer_id, location_id, treatment_id, technician_id, salesman_id,
    scheduled_date, scheduled_time, duration_minutes, crew_count, workers_info, notes,
    send_sms = false
  } = req.body;

  if (!customer_id || !treatment_id || !scheduled_date) {
    return res.status(400).json({ success: false, error: 'customer_id, treatment_id, and scheduled_date are required' });
  }

  const jobCode = generateJobCode(scheduled_date);
  const workersJson = typeof workers_info === 'object' ? JSON.stringify(workers_info) : (workers_info || null);

  try {
    const result = db.prepare(`
      INSERT INTO jobs (
        job_code, customer_id, location_id, treatment_id, technician_id,
        salesman_id, scheduled_date, scheduled_time, duration_minutes,
        crew_count, workers_info,
        status, technician_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TO_BE_DONE', ?)
    `).run(
      jobCode,
      customer_id,
      location_id || null,
      treatment_id,
      technician_id || null,
      salesman_id || null,
      scheduled_date,
      scheduled_time || '09:00',
      duration_minutes || 60,
      crew_count ? parseInt(crew_count, 10) : 1,
      workersJson,
      notes || ''
    );

    const newJobId = result.lastInsertRowid;
    db.prepare('INSERT INTO job_logs (job_id, action, notes) VALUES (?, ?, ?)').run(newJobId, 'CREATED', 'Manual job created by admin');

    let smsResult = null;
    if (technician_id && send_sms === true) {
      smsResult = await dispatchTechSmsIfAssigned(newJobId, technician_id, req.body.custom_base_url);
    }
    if (technician_id) {
      notifyJobAssigned(newJobId, technician_id).catch(err => console.warn('[Push] Error notifying assignment:', err.message));
    }

    const createdJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(newJobId);
    res.json({ success: true, job: createdJob, smsResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Job Details (Admin / Operations Edit Panel)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    customer_id, location_id, treatment_id, technician_id, salesman_id,
    scheduled_date, scheduled_time, duration_minutes, crew_count, workers_info, status, technician_notes,
    send_sms
  } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const workersJson = workers_info !== undefined
      ? (typeof workers_info === 'object' ? JSON.stringify(workers_info) : workers_info)
      : null;

    db.prepare(`
      UPDATE jobs SET
        customer_id = COALESCE(?, customer_id),
        location_id = COALESCE(?, location_id),
        treatment_id = COALESCE(?, treatment_id),
        technician_id = COALESCE(?, technician_id),
        salesman_id = COALESCE(?, salesman_id),
        scheduled_date = COALESCE(?, scheduled_date),
        scheduled_time = COALESCE(?, scheduled_time),
        duration_minutes = COALESCE(?, duration_minutes),
        crew_count = COALESCE(?, crew_count),
        workers_info = CASE WHEN ? IS NOT NULL THEN ? ELSE workers_info END,
        status = COALESCE(?, status),
        technician_notes = COALESCE(?, technician_notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      customer_id || null,
      location_id || null,
      treatment_id || null,
      technician_id !== undefined ? (technician_id || null) : null,
      salesman_id !== undefined ? (salesman_id || null) : null,
      scheduled_date || null,
      scheduled_time || null,
      duration_minutes ? parseInt(duration_minutes, 10) : null,
      crew_count ? parseInt(crew_count, 10) : null,
      workers_info !== undefined ? 1 : null,
      workersJson,
      status ? status.toUpperCase() : null,
      technician_notes !== undefined ? technician_notes : null,
      id
    );

    db.prepare('INSERT INTO job_logs (job_id, action, notes) VALUES (?, ?, ?)')
      .run(id, 'EDITED', 'Job details updated via operations edit panel');

    const updated = db.prepare(`
      SELECT j.*,
             c.name as customer_name, c.customer_code, c.phone as customer_phone,
             c.contact_person, c.special_instructions,
             l.location_name, l.address as location_address, l.latitude, l.longitude,
             t.code as treatment_code, t.name as treatment_name, t.color_hex as treatment_color,
             tech.full_name as technician_name, tech.phone as technician_phone,
             sales.full_name as salesman_name
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      LEFT JOIN customer_locations l ON j.location_id = l.id
      JOIN treatments t ON j.treatment_id = t.id
      LEFT JOIN staff tech ON j.technician_id = tech.id
      LEFT JOIN staff sales ON j.salesman_id = sales.id
      WHERE j.id = ?
    `).get(id);

    let smsResult = null;
    const finalTechId = technician_id !== undefined ? (technician_id ? parseInt(technician_id, 10) : null) : existing.technician_id;
    if (finalTechId && send_sms === true) {
      smsResult = await dispatchTechSmsIfAssigned(id, finalTechId, req.body.custom_base_url);
    }
    if (finalTechId) {
      if (existing.technician_id !== finalTechId) {
        notifyJobAssigned(id, finalTechId).catch(err => console.warn('[Push] Assign error:', err.message));
      } else {
        notifyJobUpdated(id, finalTechId).catch(err => console.warn('[Push] Update error:', err.message));
      }
    }

    res.json({ success: true, job: updated, smsResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Assign or reassign technician
router.put('/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { technician_id, crew_count, workers_info, send_sms = false } = req.body;

  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const workersJson = workers_info !== undefined
      ? (typeof workers_info === 'object' ? JSON.stringify(workers_info) : workers_info)
      : null;

    db.prepare(`
      UPDATE jobs SET
        technician_id = ?,
        crew_count = COALESCE(?, crew_count),
        workers_info = CASE WHEN ? IS NOT NULL THEN ? ELSE workers_info END,
        status = CASE WHEN status = 'TO_BE_DONE' THEN 'ASSIGNED' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      technician_id,
      crew_count ? parseInt(crew_count, 10) : null,
      workers_info !== undefined ? 1 : null,
      workersJson,
      id
    );

    db.prepare(`
      INSERT INTO job_logs (job_id, action, notes)
      VALUES (?, 'ASSIGNED', ?)
    `).run(id, `Technician assigned: ${technician_id}, crew: ${crew_count || 1}`);

    // Create notification for technician
    if (technician_id) {
      db.prepare(`
        INSERT INTO notifications (title, message, type, target_user_id, job_id)
        VALUES (?, ?, 'ASSIGNMENT', ?, ?)
      `).run('New Job Assignment', `You have been assigned job ${job.job_code} scheduled for ${job.scheduled_date}`, technician_id, id);
    }

    let smsResult = null;
    if (technician_id && send_sms === true) {
      smsResult = await dispatchTechSmsIfAssigned(id, technician_id, req.body.custom_base_url);
    }
    if (technician_id) {
      notifyJobAssigned(id, technician_id).catch(err => console.warn('[Push] Assign error:', err.message));
    }

    const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    res.json({ success: true, job: updated, smsResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk assign technician to multiple jobs
router.post('/bulk-assign', async (req, res) => {
  const { job_ids, technician_id, send_sms = false, custom_base_url } = req.body;
  if (!Array.isArray(job_ids) || job_ids.length === 0) {
    return res.status(400).json({ success: false, error: 'job_ids must be a non-empty array' });
  }

  const tx = db.transaction(() => {
    const updateStmt = db.prepare(`
      UPDATE jobs SET
        technician_id = ?,
        status = CASE WHEN status = 'TO_BE_DONE' THEN 'ASSIGNED' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const logStmt = db.prepare(`INSERT INTO job_logs (job_id, action, notes) VALUES (?, 'BULK_ASSIGNED', ?)`);

    for (const jid of job_ids) {
      updateStmt.run(technician_id, jid);
      logStmt.run(jid, `Technician ${technician_id} bulk assigned`);
    }
  });

  try {
    tx();

    let smsDispatchedCount = 0;
    if (technician_id) {
      for (const jid of job_ids) {
        if (send_sms === true) {
          await dispatchTechSmsIfAssigned(jid, technician_id, custom_base_url);
          smsDispatchedCount++;
        }
        notifyJobAssigned(jid, technician_id).catch(err => console.warn('[Push] Bulk assign error:', err.message));
      }
    }

    res.json({ success: true, updatedCount: job_ids.length, smsDispatchedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Job (technician clicks START JOB)
router.put('/:id/start', (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();

  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    db.prepare(`
      UPDATE jobs SET
        status = 'IN_PROGRESS',
        actual_start_time = COALESCE(actual_start_time, ?),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(now, id);

    db.prepare(`INSERT INTO job_logs (job_id, action, notes) VALUES (?, 'STARTED', 'Job started by technician')`).run(id);

    const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    res.json({ success: true, job: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Complete Job (technician completes with notes, signature, photos)
// Triggers automatic calculation of next service date & generation of next job!
router.put('/:id/complete', (req, res) => {
  const { id } = req.params;
  const { actual_start_time, actual_end_time, technician_notes, customer_signature, photos } = req.body;

  try {
    const result = handleJobCompletion(id, {
      actual_start_time,
      actual_end_time: actual_end_time || new Date().toISOString(),
      technician_notes,
      customer_signature,
      photos
    });

    const updatedJob = db.prepare(`
      SELECT j.*, c.name as customer_name, t.code as treatment_code
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      JOIN treatments t ON j.treatment_id = t.id
      WHERE j.id = ?
    `).get(id);

    res.json({ success: true, job: updatedJob, message: 'Job completed and next service automatically calculated!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Postpone Job
router.put('/:id/postpone', (req, res) => {
  const { id } = req.params;
  const { postponed_to_date, reason } = req.body;

  if (!postponed_to_date) {
    return res.status(400).json({ success: false, error: 'postponed_to_date is required' });
  }

  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    db.prepare(`
      UPDATE jobs SET
        status = 'POSTPONED',
        postponed_to_date = ?,
        reschedule_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(postponed_to_date, reason || 'Customer requested postponement', id);

    db.prepare(`
      INSERT INTO job_logs (job_id, action, notes)
      VALUES (?, 'POSTPONED', ?)
    `).run(id, `Job postponed from ${job.scheduled_date} to ${postponed_to_date}. Reason: ${reason || 'N/A'}`);

    // Create notification
    db.prepare(`
      INSERT INTO notifications (title, message, type, job_id, target_role)
      VALUES (?, ?, 'POSTPONED', ?, 'SUPERVISOR')
    `).run('Job Postponed', `Job ${job.job_code} postponed to ${postponed_to_date}`, id);

    if (job.technician_id) {
      notifyJobPostponed(id, job.technician_id, postponed_to_date).catch(err => console.warn('[Push] Postpone error:', err.message));
    }

    const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    res.json({ success: true, job: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cancel Job
router.put('/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    db.prepare(`
      UPDATE jobs SET
        status = 'CANCELLED',
        reschedule_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason || 'Cancelled by admin', id);

    db.prepare(`INSERT INTO job_logs (job_id, action, notes) VALUES (?, 'CANCELLED', ?)`).run(id, reason || 'Cancelled');

    if (job.technician_id) {
      notifyJobCancelled(id, job.technician_id).catch(err => console.warn('[Push] Cancel error:', err.message));
    }

    const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    res.json({ success: true, job: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
