const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { normalizeSriLankaPhone, sendSMS } = require('../services/smsGateway');

/**
 * 1. Request SMS OTP for Field Technician
 */
router.post('/request-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Mobile phone number is required' });
  }

  try {
    const normalized = normalizeSriLankaPhone(phone);
    const cleanDigits = phone.replace(/\D/g, '');

    // Search technician by phone variations
    const techs = db.prepare(`
      SELECT * FROM staff
      WHERE role = 'TECHNICIAN' AND is_active = 1
    `).all();

    const matchedTech = techs.find(t => {
      if (!t.phone) return false;
      const tClean = t.phone.replace(/\D/g, '');
      const tNorm = normalizeSriLankaPhone(t.phone).formattedPhone?.replace(/\D/g, '') || '';
      return tClean === cleanDigits ||
             tClean.endsWith(cleanDigits) ||
             cleanDigits.endsWith(tClean) ||
             (normalized.e164 && normalizeSriLankaPhone(t.phone).e164 === normalized.e164);
    });

    if (!matchedTech) {
      return res.status(404).json({
        success: false,
        error: `Mobile number ${phone} is not registered as an active field technician. Please contact your operations supervisor or admin.`
      });
    }

    // Generate 6-digit numeric OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Save to otp_verifications table
    db.prepare(`
      INSERT INTO otp_verifications (phone, technician_id, otp_code, expires_at, is_verified, attempts)
      VALUES (?, ?, ?, ?, 0, 0)
    `).run(matchedTech.phone || phone, matchedTech.id, otpCode, expiresAt);

    // Send SMS via active SMS Gateway (Text.lk / Notify.lk)
    const smsMessage = `Your PestControl Pro verification code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;
    const targetPhone = matchedTech.phone || phone;

    const smsResult = await sendSMS({
      to: targetPhone,
      message: smsMessage,
      recipientName: matchedTech.full_name
    });

    res.json({
      success: true,
      message: `Verification code sent via SMS to ${targetPhone}`,
      technician: {
        id: matchedTech.id,
        full_name: matchedTech.full_name,
        phone: targetPhone
      },
      smsStatus: smsResult.success ? 'DISPATCHED' : 'FAILED',
      // Provide debug code for instant testing if SMS gateway is in simulation or demo mode
      debugCode: otpCode,
      expiresInSeconds: 600
    });
  } catch (err) {
    console.error('[Request OTP Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. Verify SMS OTP for Field Technician
 */
router.post('/verify-otp', (req, res) => {
  const { phone, otp_code, device_info } = req.body;

  if (!phone || !otp_code) {
    return res.status(400).json({
      success: false,
      error: 'Phone number and 6-digit verification code are required'
    });
  }

  try {
    const cleanDigits = phone.replace(/\D/g, '');
    const cleanCode = String(otp_code).trim();

    // Look for matching unverified OTP record within 10 minutes
    const records = db.prepare(`
      SELECT o.*, t.full_name, t.phone as tech_phone, t.role, t.email, t.is_active
      FROM otp_verifications o
      JOIN staff t ON o.technician_id = t.id
      WHERE o.otp_code = ?
        AND o.is_verified = 0
        AND o.expires_at > datetime('now')
      ORDER BY o.created_at DESC
    `).all(cleanCode);

    const matchedRecord = records.find(r => {
      const rClean = (r.phone || '').replace(/\D/g, '');
      const tClean = (r.tech_phone || '').replace(/\D/g, '');
      return rClean === cleanDigits ||
             tClean === cleanDigits ||
             rClean.endsWith(cleanDigits) ||
             cleanDigits.endsWith(rClean);
    });

    if (!matchedRecord) {
      // Increment attempt counter if a record exists for phone
      db.prepare(`
        UPDATE otp_verifications
        SET attempts = attempts + 1
        WHERE phone LIKE ? AND is_verified = 0
      `).run(`%${cleanDigits}%`);

      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code. Please check the code or tap "Resend Code".'
      });
    }

    if (matchedRecord.is_active !== 1) {
      return res.status(401).json({
        success: false,
        error: 'Technician account has been deactivated. Please contact admin.'
      });
    }

    // Mark OTP verified
    db.prepare('UPDATE otp_verifications SET is_verified = 1 WHERE id = ?').run(matchedRecord.id);

    // Create permanent session token
    const sessionToken = `tech_${crypto.randomBytes(24).toString('hex')}`;
    const deviceStr = typeof device_info === 'object' ? JSON.stringify(device_info) : (device_info || 'Mobile PWA (SMS Verified)');

    db.prepare(`
      INSERT INTO technician_sessions (technician_id, phone, session_token, device_info)
      VALUES (?, ?, ?, ?)
    `).run(matchedRecord.technician_id, matchedRecord.tech_phone || phone, sessionToken, deviceStr);

    // Mirror to universal user_sessions
    db.prepare(`
      INSERT INTO user_sessions (user_id, session_token, role, device_info)
      VALUES (?, ?, 'TECHNICIAN', ?)
    `).run(matchedRecord.technician_id, sessionToken, deviceStr);

    res.json({
      success: true,
      message: `Verification successful! Welcome back, ${matchedRecord.full_name}.`,
      token: sessionToken,
      technician: {
        id: matchedRecord.technician_id,
        full_name: matchedRecord.full_name,
        phone: matchedRecord.tech_phone,
        role: matchedRecord.role || 'TECHNICIAN',
        email: matchedRecord.email
      }
    });
  } catch (err) {
    console.error('[Verify OTP Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Direct Phone Number Login (Preset or Bypass)
 */
router.post('/login', (req, res) => {
  const { phone, device_info } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Mobile phone number is required' });
  }

  try {
    const normalized = normalizeSriLankaPhone(phone);
    const cleanDigits = phone.replace(/\D/g, '');

    // Search technician by phone variations
    const techs = db.prepare(`
      SELECT * FROM staff
      WHERE role = 'TECHNICIAN' AND is_active = 1
    `).all();

    const matchedTech = techs.find(t => {
      if (!t.phone) return false;
      const tClean = t.phone.replace(/\D/g, '');
      const tNorm = normalizeSriLankaPhone(t.phone).formattedPhone?.replace(/\D/g, '') || '';
      return tClean === cleanDigits ||
             tClean.endsWith(cleanDigits) ||
             cleanDigits.endsWith(tClean) ||
             (normalized.e164 && normalizeSriLankaPhone(t.phone).e164 === normalized.e164);
    });

    if (!matchedTech) {
      return res.status(404).json({
        success: false,
        error: `Mobile number ${phone} is not registered as an active field technician.`
      });
    }

    // Generate persistent session token
    const sessionToken = `tech_${crypto.randomBytes(24).toString('hex')}`;
    const deviceStr = typeof device_info === 'object' ? JSON.stringify(device_info) : (device_info || 'Mobile PWA');

    db.prepare(`
      INSERT INTO technician_sessions (technician_id, phone, session_token, device_info)
      VALUES (?, ?, ?, ?)
    `).run(matchedTech.id, matchedTech.phone || phone, sessionToken, deviceStr);

    db.prepare(`
      INSERT INTO user_sessions (user_id, session_token, role, device_info)
      VALUES (?, ?, 'TECHNICIAN', ?)
    `).run(matchedTech.id, sessionToken, deviceStr);

    res.json({
      success: true,
      message: `Welcome back, ${matchedTech.full_name}! 1-time login successful.`,
      token: sessionToken,
      technician: {
        id: matchedTech.id,
        full_name: matchedTech.full_name,
        phone: matchedTech.phone,
        role: matchedTech.role,
        email: matchedTech.email
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Verify existing persistent session token
 */
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '')) || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'No session token provided' });
  }

  try {
    const session = db.prepare(`
      SELECT s.*, tech.full_name, tech.phone as tech_phone, tech.role, tech.email, tech.is_active
      FROM technician_sessions s
      JOIN staff tech ON s.technician_id = tech.id
      WHERE s.session_token = ?
    `).get(token);

    if (!session || session.is_active !== 1) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid' });
    }

    db.prepare('UPDATE technician_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(session.id);

    res.json({
      success: true,
      technician: {
        id: session.technician_id,
        full_name: session.full_name,
        phone: session.tech_phone,
        role: session.role,
        email: session.email
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. Logout / Revoke Session
 */
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '')) || req.body.token;

  if (token) {
    try {
      db.prepare('DELETE FROM technician_sessions WHERE session_token = ?').run(token);
      db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(token);
    } catch (e) {}
  }

  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
