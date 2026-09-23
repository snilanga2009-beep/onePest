const express = require('express');
const router = express.Router();
const db = require('../db');

// List treatments
router.get('/', (req, res) => {
  const { active_only } = req.query;
  let sql = 'SELECT * FROM treatments';
  if (active_only === 'true' || active_only === '1') {
    sql += ' WHERE is_active = 1';
  }
  sql += ' ORDER BY code ASC';

  const treatments = db.prepare(sql).all();
  res.json({ success: true, treatments });
});

// Create treatment
router.post('/', (req, res) => {
  const { code, name, description, default_duration_minutes, color_hex } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, error: 'code and name are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO treatments (code, name, description, default_duration_minutes, color_hex)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      code.trim().toUpperCase(),
      name.trim(),
      description || '',
      default_duration_minutes || 60,
      color_hex || '#10B981'
    );

    const treatment = db.prepare('SELECT * FROM treatments WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, treatment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update treatment
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, default_duration_minutes, color_hex, is_active } = req.body;

  try {
    db.prepare(`
      UPDATE treatments SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        default_duration_minutes = COALESCE(?, default_duration_minutes),
        color_hex = COALESCE(?, color_hex),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(name, description, default_duration_minutes, color_hex, is_active, id);

    const treatment = db.prepare('SELECT * FROM treatments WHERE id = ?').get(id);
    res.json({ success: true, treatment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
