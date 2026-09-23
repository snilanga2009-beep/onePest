const express = require('express');
const router = express.Router();
const db = require('../db');

// List customers with optional search and filter
router.get('/', (req, res) => {
  const { search, location, active_only, job_done_only, technician_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  let whereClauses = ['1=1'];
  const params = [];

  if (active_only === 'true' || active_only === '1') {
    whereClauses.push('c.is_active = 1');
  }

  if (location) {
    whereClauses.push('(c.location LIKE ? OR l.location_name LIKE ?)');
    params.push(`%${location}%`, `%${location}%`);
  }

  // Filter for customers with completed / done jobs only
  if (job_done_only === 'true' || job_done_only === '1') {
    if (technician_id) {
      whereClauses.push(`c.id IN (SELECT DISTINCT customer_id FROM jobs WHERE status = 'COMPLETED' AND technician_id = ?)`);
      params.push(technician_id);
    } else {
      whereClauses.push(`c.id IN (SELECT DISTINCT customer_id FROM jobs WHERE status = 'COMPLETED')`);
    }
  } else if (technician_id) {
    whereClauses.push(`c.id IN (SELECT DISTINCT customer_id FROM jobs WHERE technician_id = ?)`);
    params.push(technician_id);
  }

  if (search) {
    whereClauses.push(`(
      c.name LIKE ? OR 
      c.customer_code LIKE ? OR 
      c.phone LIKE ? OR 
      c.contact_person LIKE ? OR
      c.location LIKE ?
    )`);
    const q = `%${search}%`;
    params.push(q, q, q, q, q);
  }

  const whereSql = whereClauses.join(' AND ');

  const totalCount = db.prepare(`
    SELECT COUNT(DISTINCT c.id) as count
    FROM customers c
    LEFT JOIN customer_locations l ON c.id = l.customer_id
    WHERE ${whereSql}
  `).get(...params).count;

  const customers = db.prepare(`
    SELECT c.*, 
           COUNT(DISTINCT l.id) as total_locations,
           COUNT(DISTINCT r.id) as active_services,
           (SELECT COUNT(*) FROM jobs WHERE customer_id = c.id AND status = 'COMPLETED') as completed_jobs_count
    FROM customers c
    LEFT JOIN customer_locations l ON c.id = l.customer_id
    LEFT JOIN recurring_services r ON c.id = r.customer_id AND r.status = 'ACTIVE'
    WHERE ${whereSql}
    GROUP BY c.id
    ORDER BY c.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), offset);

  res.json({
    success: true,
    total: totalCount,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    customers
  });
});

// Get single customer details with locations, recurring services, and timeline history
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const { job_done_only, technician_id } = req.query;

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  // Locations
  const locations = db.prepare('SELECT * FROM customer_locations WHERE customer_id = ? ORDER BY is_primary DESC, location_name ASC').all(id);

  // Recurring services (hide in job_done_only mode for field technician privacy)
  let recurringServices = [];
  if (job_done_only !== 'true' && job_done_only !== '1') {
    recurringServices = db.prepare(`
      SELECT r.*, 
             l.location_name,
             t.code as treatment_code, t.name as treatment_name, t.color_hex as treatment_color,
             tech.full_name as technician_name,
             sales.full_name as salesman_name
      FROM recurring_services r
      LEFT JOIN customer_locations l ON r.location_id = l.id
      JOIN treatments t ON r.treatment_id = t.id
      LEFT JOIN staff tech ON r.technician_id = tech.id
      LEFT JOIN staff sales ON r.salesman_id = sales.id
      WHERE r.customer_id = ?
      ORDER BY r.status ASC, r.next_service_date ASC
    `).all(id);
  }

  // Timeline of jobs (filtered to completed jobs if job_done_only is active)
  let timelineSql = `
    SELECT j.*, 
           l.location_name,
           t.code as treatment_code, t.name as treatment_name, t.color_hex as treatment_color,
           tech.full_name as technician_name, tech.phone as technician_phone
    FROM jobs j
    LEFT JOIN customer_locations l ON j.location_id = l.id
    JOIN treatments t ON j.treatment_id = t.id
    LEFT JOIN staff tech ON j.technician_id = tech.id
    WHERE j.customer_id = ?
  `;
  const timelineParams = [id];

  if (job_done_only === 'true' || job_done_only === '1') {
    timelineSql += ` AND j.status = 'COMPLETED'`;
    if (technician_id) {
      timelineSql += ` AND j.technician_id = ?`;
      timelineParams.push(technician_id);
    }
  }

  timelineSql += ` ORDER BY j.scheduled_date DESC, j.id DESC`;
  const timeline = db.prepare(timelineSql).all(...timelineParams);

  res.json({
    success: true,
    customer,
    locations,
    recurring_services: recurringServices,
    timeline
  });
});

// Create new customer
router.post('/', (req, res) => {
  const {
    name, contact_person, phone, email, address, location,
    latitude, longitude, special_instructions, primary_location_name
  } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Customer name is required' });
  }

  // Check duplicate
  const existing = db.prepare('SELECT id, name FROM customers WHERE UPPER(name) = ?').get(name.trim().toUpperCase());
  if (existing) {
    return res.status(409).json({ success: false, error: `Customer with name '${name}' already exists (ID: ${existing.id})` });
  }

  const tx = db.transaction(() => {
    const maxId = (db.prepare('SELECT MAX(id) as m FROM customers').get().m || 0) + 1;
    const customerCode = `CUST-${String(maxId).padStart(4, '0')}`;

    const custResult = db.prepare(`
      INSERT INTO customers (
        customer_code, name, contact_person, phone, email,
        address, location, latitude, longitude, special_instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customerCode,
      name.trim(),
      contact_person || '',
      phone || '',
      email || '',
      address || '',
      location || '',
      latitude || null,
      longitude || null,
      special_instructions || ''
    );

    const customerId = custResult.lastInsertRowid;

    // Create primary location
    const locName = primary_location_name || location || name.trim() + ' Main';
    db.prepare(`
      INSERT INTO customer_locations (customer_id, location_name, address, latitude, longitude, contact_person, phone, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(customerId, locName, address || locName, latitude || null, longitude || null, contact_person || '', phone || '');

    return { customerId, customerCode };
  });

  try {
    const created = tx();
    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(created.customerId);
    res.json({ success: true, customer: newCustomer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update customer
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    name, contact_person, phone, email, address, location,
    latitude, longitude, special_instructions, is_active
  } = req.body;

  try {
    db.prepare(`
      UPDATE customers SET
        name = COALESCE(?, name),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        location = COALESCE(?, location),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        special_instructions = COALESCE(?, special_instructions),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, contact_person, phone, email, address, location, latitude, longitude, special_instructions, is_active, id);

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.json({ success: true, customer: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add location to customer
router.post('/:id/locations', (req, res) => {
  const { id } = req.params;
  const { location_name, address, latitude, longitude, contact_person, phone, is_primary } = req.body;

  if (!location_name) {
    return res.status(400).json({ success: false, error: 'location_name is required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO customer_locations (customer_id, location_name, address, latitude, longitude, contact_person, phone, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, location_name.trim(), address || location_name.trim(), latitude || null, longitude || null, contact_person || '', phone || '', is_primary ? 1 : 0);

    const location = db.prepare('SELECT * FROM customer_locations WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, location });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
