const db = require('../db');

/**
 * Helper to format a Date as YYYY-MM-DD in Asia/Colombo timezone (GMT+5:30)
 */
function formatDateColombo(date) {
  const d = new Date(date);
  // Asia/Colombo is UTC+5:30 = 330 minutes
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const colomboTime = new Date(utc + (330 * 60000));
  const year = colomboTime.getFullYear();
  const month = String(colomboTime.getMonth() + 1).padStart(2, '0');
  const day = String(colomboTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string into a Date object at midday Colombo to avoid any boundary jumps
 */
function parseDateColombo(dateStr) {
  if (!dateStr) return new Date();
  const parts = String(dateStr).trim().split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 6, 0, 0)); // 6:00 UTC = 11:30 AM Colombo
  }
  return new Date(dateStr);
}

/**
 * Calculates the next service date given a base date and frequency parameters.
 * @param {string|Date} baseDate - Last service date or start date (YYYY-MM-DD)
 * @param {string} frequency - DAILY, WEEKLY, FORTNIGHTLY, MONTHLY, 3 MONTHLY, CUSTOM
 * @param {string} [preferredDay] - Optional: MON, TUE, WED, THU, FRI, SAT, SUN
 * @param {number} [customDays=30] - Optional custom days interval
 * @returns {string} Next date in YYYY-MM-DD
 */
function calculateNextServiceDate(baseDate, frequency, preferredDay = null, customDays = 30) {
  const base = parseDateColombo(baseDate);
  const freq = (frequency || 'MONTHLY').toUpperCase().trim();
  const target = new Date(base.getTime());

  if (freq === 'DAILY') {
    target.setUTCDate(target.getUTCDate() + 1);
  } else if (freq === 'WEEKLY') {
    target.setUTCDate(target.getUTCDate() + 7);
    if (preferredDay) {
      alignToDayOfWeek(target, preferredDay);
    }
  } else if (freq === 'FORTNIGHTLY') {
    target.setUTCDate(target.getUTCDate() + 14);
    if (preferredDay) {
      alignToDayOfWeek(target, preferredDay);
    }
  } else if (freq === 'MONTHLY') {
    const currentDay = target.getUTCDate();
    target.setUTCMonth(target.getUTCMonth() + 1);
    // Handle month overflow (e.g. Jan 31 -> Feb 28)
    if (target.getUTCDate() !== currentDay) {
      target.setUTCDate(0); // Last day of previous month
    }
    if (preferredDay) {
      // Find nearest preferred day within 3 days if requested
      alignToNearestDayOfWeek(target, preferredDay);
    }
  } else if (freq === '3 MONTHLY' || freq === '3MONTHLY' || freq === 'QUARTERLY') {
    const currentDay = target.getUTCDate();
    target.setUTCMonth(target.getUTCMonth() + 3);
    if (target.getUTCDate() !== currentDay) {
      target.setUTCDate(0);
    }
    if (preferredDay) {
      alignToNearestDayOfWeek(target, preferredDay);
    }
  } else if (freq === 'CUSTOM') {
    target.setUTCDate(target.getUTCDate() + (customDays || 30));
  } else {
    // Default fallback monthly
    target.setUTCMonth(target.getUTCMonth() + 1);
  }

  return formatDateColombo(target);
}

const DAY_MAP = {
  SUN: 0, SUNDAY: 0,
  MON: 1, MONDAY: 1,
  TUE: 2, TUESDAY: 2,
  WED: 3, WEDNESDAY: 3,
  THU: 4, THURSDAY: 4,
  FRI: 5, FRIDAY: 5,
  SAT: 6, SATURDAY: 6
};

function alignToDayOfWeek(dateObj, preferredDay) {
  const norm = String(preferredDay).trim().toUpperCase();
  if (DAY_MAP[norm] !== undefined) {
    const targetDay = DAY_MAP[norm];
    const currentDay = dateObj.getUTCDay();
    const diff = (targetDay - currentDay + 7) % 7;
    if (diff !== 0) {
      dateObj.setUTCDate(dateObj.getUTCDate() + diff);
    }
  }
}

function alignToNearestDayOfWeek(dateObj, preferredDay) {
  const norm = String(preferredDay).trim().toUpperCase();
  if (DAY_MAP[norm] !== undefined) {
    const targetDay = DAY_MAP[norm];
    const currentDay = dateObj.getUTCDay();
    let diff = targetDay - currentDay;
    if (diff > 3) diff -= 7;
    if (diff < -3) diff += 7;
    dateObj.setUTCDate(dateObj.getUTCDate() + diff);
  }
}

/**
 * Generate a unique job code: JOB-YYYYMMDD-XXXX
 */
function generateJobCode(dateStr) {
  const cleanDate = (dateStr || formatDateColombo(new Date())).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `JOB-${cleanDate}-${rand}`;
}

/**
 * Automatically generates jobs for all active recurring services that are due
 * up to a certain horizon date (default 14 days ahead).
 * @param {number} horizonDays - Days ahead to generate jobs for (default 14)
 * @returns {Array} List of newly created jobs
 */
function generateJobsForDueServices(horizonDays = 14) {
  const today = formatDateColombo(new Date());
  const maxDateObj = parseDateColombo(today);
  maxDateObj.setUTCDate(maxDateObj.getUTCDate() + horizonDays);
  const horizonDate = formatDateColombo(maxDateObj);

  // Fetch all active recurring services where next_service_date <= horizonDate
  const dueServices = db.prepare(`
    SELECT r.*, c.customer_code, c.name as customer_name, c.special_instructions,
           l.location_name, l.address as location_address,
           t.code as treatment_code, t.default_duration_minutes,
           tech.full_name as technician_name,
           sales.full_name as salesman_name
    FROM recurring_services r
    JOIN customers c ON r.customer_id = c.id
    LEFT JOIN customer_locations l ON r.location_id = l.id
    JOIN treatments t ON r.treatment_id = t.id
    LEFT JOIN staff tech ON r.technician_id = tech.id
    LEFT JOIN staff sales ON r.salesman_id = sales.id
    WHERE r.status = 'ACTIVE' 
      AND c.is_active = 1
      AND r.next_service_date <= ?
    ORDER BY r.next_service_date ASC
  `).all(horizonDate);

  const checkExistingJob = db.prepare(`
    SELECT id FROM jobs 
    WHERE recurring_service_id = ? AND scheduled_date = ?
  `);

  const insertJob = db.prepare(`
    INSERT INTO jobs (
      job_code, recurring_service_id, customer_id, location_id, treatment_id,
      technician_id, salesman_id, scheduled_date, scheduled_time, duration_minutes,
      status, technician_notes
    ) VALUES (
      @job_code, @recurring_service_id, @customer_id, @location_id, @treatment_id,
      @technician_id, @salesman_id, @scheduled_date, @scheduled_time, @duration_minutes,
      'TO_BE_DONE', @technician_notes
    )
  `);

  const logJobAction = db.prepare(`
    INSERT INTO job_logs (job_id, action, notes)
    VALUES (?, 'GENERATED_FROM_RECURRING', 'Automated recurring engine job generation')
  `);

  const createdJobs = [];

  const tx = db.transaction(() => {
    for (const service of dueServices) {
      const existing = checkExistingJob.get(service.id, service.next_service_date);
      if (!existing) {
        const jobCode = generateJobCode(service.next_service_date);
        const jobData = {
          job_code: jobCode,
          recurring_service_id: service.id,
          customer_id: service.customer_id,
          location_id: service.location_id,
          treatment_id: service.treatment_id,
          technician_id: service.technician_id,
          salesman_id: service.salesman_id,
          scheduled_date: service.next_service_date,
          scheduled_time: service.preferred_time || '09:00',
          duration_minutes: service.duration_minutes || service.default_duration_minutes || 60,
          technician_notes: service.notes || service.special_instructions || ''
        };

        const result = insertJob.run(jobData);
        logJobAction.run(result.lastInsertRowid);
        createdJobs.push({ id: result.lastInsertRowid, job_code: jobCode, ...jobData, customer_name: service.customer_name });
      }
    }
  });

  tx();
  return createdJobs;
}

/**
 * Hook called when a job is marked as COMPLETED.
 * Automatically updates the recurring service and generates the next job!
 * @param {number} jobId - Job ID
 * @param {object} completionData - { actual_start_time, actual_end_time, technician_notes, customer_signature, photos }
 */
function handleJobCompletion(jobId, completionData = {}) {
  const job = db.prepare(`
    SELECT j.*, r.frequency, r.preferred_day, r.preferred_time, r.duration_minutes as rec_duration
    FROM jobs j
    LEFT JOIN recurring_services r ON j.recurring_service_id = r.id
    WHERE j.id = ?
  `).get(jobId);

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const now = new Date().toISOString();
  const completionDate = job.scheduled_date || formatDateColombo(new Date());

  const tx = db.transaction(() => {
    // 1. Update the job status
    db.prepare(`
      UPDATE jobs SET
        status = 'COMPLETED',
        actual_start_time = COALESCE(?, actual_start_time, ?),
        actual_end_time = COALESCE(?, actual_end_time, ?),
        technician_notes = COALESCE(?, technician_notes),
        customer_signature = COALESCE(?, customer_signature),
        completed_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      completionData.actual_start_time,
      now,
      completionData.actual_end_time,
      now,
      completionData.technician_notes,
      completionData.customer_signature,
      now,
      jobId
    );

    // Save photos if provided
    if (Array.isArray(completionData.photos)) {
      const insertPhoto = db.prepare(`
        INSERT INTO job_photos (job_id, photo_url, photo_type, notes)
        VALUES (?, ?, ?, ?)
      `);
      for (const p of completionData.photos) {
        insertPhoto.run(jobId, p.url || p, p.type || 'COMPLETION', p.notes || '');
      }
    }

    // Log the completion
    db.prepare(`
      INSERT INTO job_logs (job_id, action, notes)
      VALUES (?, 'COMPLETED', ?)
    `).run(jobId, completionData.technician_notes || 'Completed by technician via mobile app');

    // 2. If this was a recurring job, calculate next service date and advance recurring schedule
    if (job.recurring_service_id) {
      const nextDate = calculateNextServiceDate(
        completionDate,
        job.frequency,
        job.preferred_day
      );

      // Update recurring service
      db.prepare(`
        UPDATE recurring_services SET
          last_service_date = ?,
          next_service_date = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(completionDate, nextDate, job.recurring_service_id);

      // 3. Automatically generate the next job for the new next_service_date!
      const existingNextJob = db.prepare(`
        SELECT id FROM jobs WHERE recurring_service_id = ? AND scheduled_date = ?
      `).get(job.recurring_service_id, nextDate);

      if (!existingNextJob) {
        const nextJobCode = generateJobCode(nextDate);
        const nextJobResult = db.prepare(`
          INSERT INTO jobs (
            job_code, recurring_service_id, customer_id, location_id, treatment_id,
            technician_id, salesman_id, scheduled_date, scheduled_time, duration_minutes,
            status, technician_notes
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            'TO_BE_DONE', ?
          )
        `).run(
          nextJobCode,
          job.recurring_service_id,
          job.customer_id,
          job.location_id,
          job.treatment_id,
          job.technician_id,
          job.salesman_id,
          nextDate,
          job.scheduled_time || '09:00',
          job.duration_minutes || 60,
          `Next recurring service scheduled after completion of ${job.job_code}`
        );

        db.prepare(`
          INSERT INTO job_logs (job_id, action, notes)
          VALUES (?, 'AUTO_SCHEDULED_NEXT', ?)
        `).run(nextJobResult.lastInsertRowid, `Automatically generated next recurring job following completion of ${job.job_code}`);

        // Create notification for staff
        db.prepare(`
          INSERT INTO notifications (title, message, type, job_id)
          VALUES (?, ?, 'UPCOMING', ?)
        `).run(
          'Next Service Auto-Scheduled',
          `Job ${nextJobCode} automatically scheduled for ${nextDate}`,
          nextJobResult.lastInsertRowid
        );
      }
    }
  });

  tx();

  return { success: true, jobId, status: 'COMPLETED' };
}

/**
 * Daily Maintenance Routine:
 * 1. Checks recurring services
 * 2. Generates upcoming jobs (next 14 days)
 * 3. Identifies and flags overdue jobs
 * 4. Generates overdue/reminder notifications
 */
function runDailyAutomation() {
  const today = formatDateColombo(new Date());

  // 1. Generate upcoming jobs for the next 14 days
  const newJobs = generateJobsForDueServices(14);

  // 2. Detect overdue jobs (scheduled_date < today AND status IN ('TO_BE_DONE', 'ASSIGNED', 'CONFIRMED'))
  const overdueJobs = db.prepare(`
    SELECT j.*, c.name as customer_name
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.scheduled_date < ? 
      AND j.status IN ('TO_BE_DONE', 'ASSIGNED', 'CONFIRMED')
  `).all(today);

  // Create notifications for overdue jobs if not already notified today
  for (const job of overdueJobs) {
    const existingNotif = db.prepare(`
      SELECT id FROM notifications 
      WHERE job_id = ? AND type = 'OVERDUE' AND DATE(created_at) = ?
    `).get(job.id, today);

    if (!existingNotif) {
      db.prepare(`
        INSERT INTO notifications (title, message, type, job_id, target_role)
        VALUES (?, ?, 'OVERDUE', ?, 'SUPERVISOR')
      `).run(
        'Overdue Service Job',
        `Job ${job.job_code} for ${job.customer_name} scheduled for ${job.scheduled_date} is overdue!`,
        job.id
      );
    }
  }

  return {
    today,
    generatedJobsCount: newJobs.length,
    overdueJobsCount: overdueJobs.length,
    generatedJobs: newJobs,
    overdueJobs: overdueJobs
  };
}

module.exports = {
  formatDateColombo,
  parseDateColombo,
  calculateNextServiceDate,
  generateJobCode,
  generateJobsForDueServices,
  handleJobCompletion,
  runDailyAutomation
};
