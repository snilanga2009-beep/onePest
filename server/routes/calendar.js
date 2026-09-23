const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/events', (req, res) => {
  const { start_date, end_date, technician_id, status, treatment_id, frequency, location } = req.query;

  let whereClauses = ['1=1'];
  const params = [];

  if (start_date) {
    whereClauses.push('j.scheduled_date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    whereClauses.push('j.scheduled_date <= ?');
    params.push(end_date);
  }
  if (technician_id) {
    whereClauses.push('j.technician_id = ?');
    params.push(technician_id);
  }
  if (status) {
    whereClauses.push('j.status = ?');
    params.push(status.toUpperCase());
  }
  if (treatment_id) {
    whereClauses.push('j.treatment_id = ?');
    params.push(treatment_id);
  }
  if (frequency) {
    whereClauses.push('r.frequency = ?');
    params.push(frequency.toUpperCase());
  }
  if (location) {
    whereClauses.push('(l.location_name LIKE ? OR c.location LIKE ?)');
    params.push(`%${location}%`, `%${location}%`);
  }

  const jobs = db.prepare(`
    SELECT j.id, j.job_code, j.scheduled_date, j.scheduled_time, j.duration_minutes,
           j.status, j.technician_notes,
           c.name as customer_name, c.customer_code, c.phone as customer_phone,
           l.location_name,
           t.code as treatment_code, t.name as treatment_name, t.color_hex as treatment_color,
           tech.full_name as technician_name,
           r.frequency as recurring_frequency
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    LEFT JOIN recurring_services r ON j.recurring_service_id = r.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY j.scheduled_date ASC, j.scheduled_time ASC
  `).all(...params);

  // Group by date for easy calendar grid rendering
  const eventsByDate = {};
  for (const job of jobs) {
    if (!eventsByDate[job.scheduled_date]) {
      eventsByDate[job.scheduled_date] = [];
    }
    eventsByDate[job.scheduled_date].push(job);
  }

  res.json({
    success: true,
    total: jobs.length,
    events: jobs,
    eventsByDate
  });
});

module.exports = router;
