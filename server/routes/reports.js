const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const db = require('../db');
const { formatDateColombo } = require('../services/recurringEngine');

/**
 * Helper to fetch report data based on report type and filters
 */
function getReportData(type, query = {}) {
  const { date, from_date, to_date, technician_id, customer_id, treatment_id } = query;
  const today = date || formatDateColombo(new Date());

  let sql = `
    SELECT j.id, j.job_code, j.scheduled_date, j.scheduled_time, j.duration_minutes,
           j.status, j.actual_start_time, j.actual_end_time, j.technician_notes,
           j.postponed_to_date, j.reschedule_reason,
           c.name as customer_name, c.customer_code, c.phone as customer_phone,
           l.location_name,
           t.code as treatment_code, t.name as treatment_name,
           tech.full_name as technician_name,
           sales.full_name as salesman_name,
           r.frequency as recurring_frequency
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    LEFT JOIN staff sales ON j.salesman_id = sales.id
    LEFT JOIN recurring_services r ON j.recurring_service_id = r.id
    WHERE 1=1
  `;
  const params = [];

  switch (type) {
    case 'daily':
      sql += ' AND j.scheduled_date = ?';
      params.push(today);
      break;

    case 'weekly':
      // From 7 days prior to today or specific range
      const startDate = from_date || today;
      const endD = new Date(startDate);
      endD.setDate(endD.getDate() + 7);
      const endDate = to_date || formatDateColombo(endD);
      sql += ' AND j.scheduled_date >= ? AND j.scheduled_date <= ?';
      params.push(startDate, endDate);
      break;

    case 'monthly':
      const mStart = from_date || today.substring(0, 7) + '-01';
      const mEnd = to_date || today.substring(0, 7) + '-31';
      sql += ' AND j.scheduled_date >= ? AND j.scheduled_date <= ?';
      params.push(mStart, mEnd);
      break;

    case 'technician':
      if (technician_id) {
        sql += ' AND j.technician_id = ?';
        params.push(technician_id);
      }
      if (from_date) {
        sql += ' AND j.scheduled_date >= ?';
        params.push(from_date);
      }
      if (to_date) {
        sql += ' AND j.scheduled_date <= ?';
        params.push(to_date);
      }
      break;

    case 'customer_history':
      if (customer_id) {
        sql += ' AND j.customer_id = ?';
        params.push(customer_id);
      }
      break;

    case 'treatment':
      if (treatment_id) {
        sql += ' AND j.treatment_id = ?';
        params.push(treatment_id);
      }
      break;

    case 'pending':
      sql += " AND j.status IN ('TO_BE_DONE', 'ASSIGNED', 'CONFIRMED')";
      break;

    case 'overdue':
      sql += " AND j.scheduled_date < ? AND j.status IN ('TO_BE_DONE', 'ASSIGNED', 'CONFIRMED')";
      params.push(today);
      break;

    case 'postponed':
      sql += " AND j.status = 'POSTPONED'";
      break;

    default:
      break;
  }

  sql += ' ORDER BY j.scheduled_date DESC, j.scheduled_time ASC';

  const rows = db.prepare(sql).all(...params);
  return { type, count: rows.length, rows };
}

// Get Report Data in JSON
router.get('/:type', (req, res) => {
  try {
    const data = getReportData(req.params.type, req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export CSV
router.get('/:type/export/csv', (req, res) => {
  try {
    const { rows } = getReportData(req.params.type, req.query);

    const headers = [
      'Job Code', 'Scheduled Date', 'Time', 'Customer', 'Location',
      'Contact', 'Treatment', 'Status', 'Technician', 'Salesman',
      'Start Time', 'End Time', 'Notes'
    ];

    const lines = [headers.join(',')];

    for (const r of rows) {
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      lines.push([
        escape(r.job_code),
        escape(r.scheduled_date),
        escape(r.scheduled_time),
        escape(r.customer_name),
        escape(r.location_name),
        escape(r.customer_phone),
        escape(r.treatment_code),
        escape(r.status),
        escape(r.technician_name),
        escape(r.salesman_name),
        escape(r.actual_start_time),
        escape(r.actual_end_time),
        escape(r.technician_notes)
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_report.csv"`);
    res.send(lines.join('\r\n'));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export Excel (.xlsx)
router.get('/:type/export/excel', (req, res) => {
  try {
    const { rows } = getReportData(req.params.type, req.query);

    const excelRows = rows.map(r => ({
      'Job Code': r.job_code,
      'Date': r.scheduled_date,
      'Time': r.scheduled_time || '09:00',
      'Customer': r.customer_name,
      'Customer Code': r.customer_code,
      'Location': r.location_name,
      'Contact': r.customer_phone,
      'Treatment': r.treatment_code,
      'Status': r.status,
      'Technician': r.technician_name || 'Unassigned',
      'Salesman': r.salesman_name || 'Unassigned',
      'Frequency': r.recurring_frequency || 'N/A',
      'Start Time': r.actual_start_time || '',
      'End Time': r.actual_end_time || '',
      'Notes': r.technician_notes || ''
    }));

    const ws = xlsx.utils.json_to_sheet(excelRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Report');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_report.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
