const express = require('express');
const router = express.Router();
const db = require('../db');
const { runDailyAutomation, generateJobsForDueServices } = require('../services/recurringEngine');

// Trigger Daily Automation routine
router.post('/run-daily', (req, res) => {
  try {
    const result = runDailyAutomation();
    res.json({
      success: true,
      message: 'Daily automation completed successfully!',
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger generation for specific horizon days
router.post('/generate-jobs', (req, res) => {
  const { horizon_days = 14 } = req.body;
  try {
    const createdJobs = generateJobsForDueServices(parseInt(horizon_days, 10));
    res.json({
      success: true,
      message: `Generated ${createdJobs.length} new jobs for the next ${horizon_days} days`,
      count: createdJobs.length,
      jobs: createdJobs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global Search endpoint
// Global search must find: Customer, Phone, Location, Job ID, Technician, Treatment
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length === 0) {
    return res.json({ success: true, results: { customers: [], jobs: [], technicians: [], treatments: [] } });
  }

  const query = `%${q.trim()}%`;

  const customers = db.prepare(`
    SELECT id, customer_code, name, contact_person, phone, location
    FROM customers
    WHERE name LIKE ? OR customer_code LIKE ? OR phone LIKE ? OR contact_person LIKE ? OR location LIKE ?
    LIMIT 10
  `).all(query, query, query, query, query);

  const jobs = db.prepare(`
    SELECT j.id, j.job_code, j.scheduled_date, j.scheduled_time, j.status,
           c.name as customer_name, l.location_name, t.code as treatment_code
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    WHERE j.job_code LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR l.location_name LIKE ? OR t.code LIKE ?
    LIMIT 10
  `).all(query, query, query, query, query);

  const technicians = db.prepare(`
    SELECT id, username, full_name, role, phone
    FROM staff
    WHERE (full_name LIKE ? OR username LIKE ? OR phone LIKE ?) AND role = 'TECHNICIAN'
    LIMIT 5
  `).all(query, query, query);

  const treatments = db.prepare(`
    SELECT id, code, name, color_hex
    FROM treatments
    WHERE code LIKE ? OR name LIKE ?
    LIMIT 5
  `).all(query, query);

  res.json({
    success: true,
    results: {
      customers,
      jobs,
      technicians,
      treatments
    }
  });
});

module.exports = router;
