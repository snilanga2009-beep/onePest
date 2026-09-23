const express = require('express');
const router = express.Router();
const db = require('../db');

// List notifications
router.get('/', (req, res) => {
  const { role, user_id, unread_only } = req.query;

  let sql = 'SELECT * FROM notifications WHERE 1=1';
  const params = [];

  if (unread_only === 'true' || unread_only === '1') {
    sql += ' AND is_read = 0';
  }

  if (role) {
    sql += ' AND (target_role = ? OR target_role IS NULL)';
    params.push(role.toUpperCase());
  }

  if (user_id) {
    sql += ' AND (target_user_id = ? OR target_user_id IS NULL)';
    params.push(user_id);
  }

  sql += ' ORDER BY created_at DESC LIMIT 50';

  const notifications = db.prepare(sql).all(...params);
  const unreadCount = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').get().c;

  res.json({ success: true, unreadCount, notifications });
});

// Mark single as read
router.put('/:id/read', (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  res.json({ success: true });
});

// Mark all as read
router.post('/mark-all-read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ success: true });
});

module.exports = router;
