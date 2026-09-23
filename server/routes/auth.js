const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

/**
 * Universal Login for ALL Roles: ADMIN, MANAGER, SUPERVISOR, TECHNICIAN, SALESMAN
 */
router.post('/login', (req, res) => {
  const { username, identifier, password, role, device_info } = req.body;
  const loginIdentifier = (username || identifier || '').trim();

  if (!loginIdentifier || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username, phone number, or email and password are required'
    });
  }

  try {
    // Search user by username, full_name, email, or phone (normalized digits)
    const cleanDigits = loginIdentifier.replace(/\D/g, '');
    const last9 = cleanDigits.length >= 9 ? cleanDigits.slice(-9) : cleanDigits;

    const allStaff = db.prepare('SELECT * FROM staff WHERE is_active = 1').all();
    const matchedUsers = allStaff.filter(u => {
      if (role && role !== 'ALL' && u.role !== role.toUpperCase()) return false;
      const uUser = (u.username || '').toLowerCase();
      const uName = (u.full_name || '').toLowerCase();
      const uEmail = (u.email || '').toLowerCase();
      const target = loginIdentifier.toLowerCase();

      if (uUser === target || uName === target || uEmail === target) return true;

      if (u.phone && cleanDigits.length >= 7) {
        const uClean = u.phone.replace(/\D/g, '');
        const uLast9 = uClean.length >= 9 ? uClean.slice(-9) : uClean;
        if (uClean === cleanDigits || uClean.endsWith(cleanDigits) || cleanDigits.endsWith(uClean)) return true;
        if (last9 && uLast9 && (last9 === uLast9 || uClean.includes(last9) || cleanDigits.includes(uClean))) return true;
      }
      return false;
    });

    if (!matchedUsers || matchedUsers.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User not found or account is deactivated.'
      });
    }

    // Check password for matched user(s)
    let authenticatedUser = null;

    for (const u of matchedUsers) {
      if (!u.password_hash || !u.password_salt) {
        // Fallback for unset password: check default role-based password
        let defaultPass = 'tech123';
        if (u.role === 'ADMIN') defaultPass = 'admin123';
        else if (u.role === 'MANAGER') defaultPass = 'manager123';
        else if (u.role === 'SUPERVISOR') defaultPass = 'supervisor123';
        else if (u.role === 'SALESMAN') defaultPass = 'sales123';

        if (password === defaultPass) {
          // Initialize their salt and hash now
          const salt = db.generateSalt();
          const hash = db.hashPassword(password, salt);
          db.prepare('UPDATE staff SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, u.id);
          authenticatedUser = u;
          break;
        }
      } else {
        const computedHash = db.hashPassword(password, u.password_salt);
        if (computedHash === u.password_hash) {
          authenticatedUser = u;
          break;
        }
      }
    }

    if (!authenticatedUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password. Please check your credentials.'
      });
    }

    // Generate Session Token
    const sessionToken = `usr_${crypto.randomBytes(24).toString('hex')}`;
    const deviceStr = typeof device_info === 'object' ? JSON.stringify(device_info) : (device_info || 'Web Portal');

    db.prepare(`
      INSERT INTO user_sessions (user_id, session_token, role, device_info)
      VALUES (?, ?, ?, ?)
    `).run(authenticatedUser.id, sessionToken, authenticatedUser.role, deviceStr);

    res.json({
      success: true,
      message: `Welcome back, ${authenticatedUser.full_name}!`,
      token: sessionToken,
      user: {
        id: authenticatedUser.id,
        username: authenticatedUser.username,
        full_name: authenticatedUser.full_name,
        role: authenticatedUser.role,
        phone: authenticatedUser.phone,
        email: authenticatedUser.email
      }
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Validate current session token
 */
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '')) || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'No session token provided' });
  }

  try {
    // 1. Check user_sessions
    const session = db.prepare(`
      SELECT s.*, u.username, u.full_name, u.phone, u.email, u.is_active
      FROM user_sessions s
      JOIN staff u ON s.user_id = u.id
      WHERE s.session_token = ?
    `).get(token);

    if (session) {
      if (session.is_active !== 1) {
        return res.status(401).json({ success: false, error: 'Account is deactivated' });
      }
      db.prepare('UPDATE user_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(session.id);
      return res.json({
        success: true,
        user: {
          id: session.user_id,
          username: session.username,
          full_name: session.full_name,
          role: session.role,
          phone: session.phone,
          email: session.email
        }
      });
    }

    // 2. Also check technician_sessions (for backward compatibility with technician 1-time phone logins)
    const techSession = db.prepare(`
      SELECT s.*, t.username, t.full_name, t.phone, t.email, t.is_active, t.role
      FROM technician_sessions s
      JOIN staff t ON s.technician_id = t.id
      WHERE s.session_token = ?
    `).get(token);

    if (techSession) {
      if (techSession.is_active !== 1) {
        return res.status(401).json({ success: false, error: 'Account is deactivated' });
      }
      db.prepare('UPDATE technician_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(techSession.id);
      return res.json({
        success: true,
        user: {
          id: techSession.technician_id,
          username: techSession.username,
          full_name: techSession.full_name,
          role: techSession.role || 'TECHNICIAN',
          phone: techSession.phone,
          email: techSession.email
        }
      });
    }

    return res.status(401).json({ success: false, error: 'Session expired or invalid' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Logout / Revoke Session
 */
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '')) || req.body.token;

  if (token) {
    try {
      db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(token);
      db.prepare('DELETE FROM technician_sessions WHERE session_token = ?').run(token);
    } catch (e) {}
  }

  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Change Password (Self-service)
 */
router.post('/change-password', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '')) || req.body.token;
  const { current_password, new_password, user_id } = req.body;

  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ success: false, error: 'New password must be at least 4 characters long' });
  }

  try {
    let targetUserId = user_id;

    if (!targetUserId && token) {
      const s = db.prepare('SELECT user_id FROM user_sessions WHERE session_token = ?').get(token) ||
                db.prepare('SELECT technician_id as user_id FROM technician_sessions WHERE session_token = ?').get(token);
      if (s) targetUserId = s.user_id;
    }

    if (!targetUserId) {
      return res.status(401).json({ success: false, error: 'Unauthorized to change password' });
    }

    const user = db.prepare('SELECT * FROM staff WHERE id = ?').get(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verify current password if provided
    if (current_password && user.password_hash && user.password_salt) {
      const hash = db.hashPassword(current_password, user.password_salt);
      if (hash !== user.password_hash) {
        return res.status(400).json({ success: false, error: 'Current password does not match' });
      }
    }

    // Update password
    const salt = db.generateSalt();
    const hash = db.hashPassword(new_password, salt);
    db.prepare('UPDATE staff SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, targetUserId);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
