const express = require('express');
const router = express.Router();
const db = require('../db');
const { formatDateColombo } = require('../services/recurringEngine');

router.get('/', (req, res) => {
  const { date } = req.query;
  const today = date || formatDateColombo(new Date());

  // Calculate tomorrow's date
  const tomorrowObj = new Date(today);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrow = formatDateColombo(tomorrowObj);

  // Statistics
  const todayStats = db.prepare(`
    SELECT
      COUNT(*) as total_today,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_today,
      SUM(CASE WHEN status IN ('TO_BE_DONE', 'ASSIGNED') THEN 1 ELSE 0 END) as pending_today,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_today,
      SUM(CASE WHEN status = 'POSTPONED' THEN 1 ELSE 0 END) as postponed_today
    FROM jobs
    WHERE scheduled_date = ?
  `).get(today);

  const tomorrowCount = db.prepare(`
    SELECT COUNT(*) as count FROM jobs WHERE scheduled_date = ?
  `).get(tomorrow).count;

  const overdueCount = db.prepare(`
    SELECT COUNT(*) as count FROM jobs 
    WHERE scheduled_date < ? AND status IN ('TO_BE_DONE', 'ASSIGNED', 'CONFIRMED')
  `).get(today).count;

  const totalPending = db.prepare(`
    SELECT COUNT(*) as count FROM jobs 
    WHERE status IN ('TO_BE_DONE', 'ASSIGNED')
  `).get().count;

  const totalCompleted = db.prepare(`
    SELECT COUNT(*) as count FROM jobs 
    WHERE status = 'COMPLETED'
  `).get().count;

  const totalPostponed = db.prepare(`
    SELECT COUNT(*) as count FROM jobs 
    WHERE status = 'POSTPONED'
  `).get().count;

  const unconfirmedCount = db.prepare(`
    SELECT COUNT(*) as count FROM jobs 
    WHERE scheduled_date >= ? AND customer_confirmation_status = 'UNCONFIRMED'
  `).get(today).count;

  // Today's jobs detailed list
  const todayJobs = db.prepare(`
    SELECT j.*, 
           c.name as customer_name, c.phone as customer_phone, c.customer_code,
           l.location_name, l.address as location_address, l.latitude, l.longitude,
           t.code as treatment_code, t.name as treatment_name, t.color_hex as treatment_color,
           tech.full_name as technician_name, tech.phone as technician_phone
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    WHERE j.scheduled_date = ?
    ORDER BY j.scheduled_time ASC, j.id ASC
  `).all(today);

  // Overdue jobs list preview
  const overdueJobs = db.prepare(`
    SELECT j.*, 
           c.name as customer_name, c.phone as customer_phone,
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
    LIMIT 10
  `).all(today);

  // Next 7 days job count breakdown
  const next7Days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(today);
    cur.setDate(cur.getDate() + i);
    const dateStr = formatDateColombo(cur);
    const count = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE scheduled_date = ?').get(dateStr).count;
    next7Days.push({ date: dateStr, count });
  }

  res.json({
    success: true,
    today,
    tomorrow,
    counters: {
      today_jobs: todayStats.total_today || 0,
      tomorrow_jobs: tomorrowCount,
      pending_jobs: totalPending,
      completed_jobs: totalCompleted,
      overdue_jobs: overdueCount,
      postponed_jobs: totalPostponed,
      unconfirmed_jobs: unconfirmedCount
    },
    today_stats: {
      total: todayStats.total_today || 0,
      completed: todayStats.completed_today || 0,
      pending: todayStats.pending_today || 0,
      in_progress: todayStats.in_progress_today || 0,
      postponed: todayStats.postponed_today || 0
    },
    today_jobs: todayJobs,
    overdue_jobs: overdueJobs,
    next_7_days: next7Days
  });
});

module.exports = router;
