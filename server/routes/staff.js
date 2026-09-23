const express = require('express');
const router = express.Router();
const db = require('../db');

// List staff
router.get('/', (req, res) => {
  const { role, active_only } = req.query;
  let sql = 'SELECT * FROM staff WHERE 1=1';
  const params = [];

  if (active_only === 'true' || active_only === '1') {
    sql += ' AND is_active = 1';
  }
  if (role) {
    sql += ' AND role = ?';
    params.push(role.toUpperCase());
  }
  sql += ' ORDER BY full_name ASC';

  const staff = db.prepare(sql).all(...params);
  res.json({ success: true, staff });
});

// Create staff
router.post('/', (req, res) => {
  const { username, full_name, role, phone, email, password } = req.body;
  if (!username || !full_name || !role) {
    return res.status(400).json({ success: false, error: 'username, full_name, and role are required' });
  }

  try {
    const plainPass = password || (
      role.toUpperCase() === 'ADMIN' ? 'admin123' :
      role.toUpperCase() === 'MANAGER' ? 'manager123' :
      role.toUpperCase() === 'SUPERVISOR' ? 'supervisor123' :
      role.toUpperCase() === 'SALESMAN' ? 'sales123' : 'tech123'
    );
    const salt = db.generateSalt();
    const hash = db.hashPassword(plainPass, salt);

    const result = db.prepare(`
      INSERT INTO staff (username, full_name, role, phone, email, password_hash, password_salt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(username.trim().toLowerCase(), full_name.trim(), role.toUpperCase(), phone || '', email || '', hash, salt);

    const newStaff = db.prepare('SELECT id, username, full_name, role, phone, email, is_active, created_at FROM staff WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, staff: newStaff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update staff details
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { full_name, role, phone, email, is_active, password } = req.body;

  try {
    let hash = null;
    let salt = null;
    if (password && password.trim()) {
      salt = db.generateSalt();
      hash = db.hashPassword(password.trim(), salt);
    }

    db.prepare(`
      UPDATE staff SET
        full_name = COALESCE(?, full_name),
        role = COALESCE(?, role),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        is_active = COALESCE(?, is_active),
        password_hash = COALESCE(?, password_hash),
        password_salt = COALESCE(?, password_salt)
      WHERE id = ?
    `).run(full_name, role ? role.toUpperCase() : null, phone, email, is_active, hash, salt, id);

    const updated = db.prepare('SELECT id, username, full_name, role, phone, email, is_active, created_at FROM staff WHERE id = ?').get(id);
    res.json({ success: true, staff: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Set / Reset staff password explicitly
router.put('/:id/password', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long' });
  }

  try {
    const salt = db.generateSalt();
    const hash = db.hashPassword(password.trim(), salt);

    db.prepare('UPDATE staff SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, id);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete or deactivate staff
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    // If staff has linked jobs or recurring services, soft-deactivate; otherwise delete
    const hasJobs = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE technician_id = ? OR salesman_id = ?').get(id, id).c;
    if (hasJobs > 0) {
      db.prepare('UPDATE staff SET is_active = 0 WHERE id = ?').run(id);
      res.json({ success: true, message: 'Staff member deactivated (has linked jobs history)' });
    } else {
      db.prepare('DELETE FROM staff WHERE id = ?').run(id);
      res.json({ success: true, message: 'Staff member removed successfully' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
