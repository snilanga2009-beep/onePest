const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

const DB_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'pest_control.db');
const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);

// Migrations for existing database
try {
  db.exec("ALTER TABLE jobs ADD COLUMN crew_count INTEGER DEFAULT 1");
} catch (e) {}
try {
  db.exec("ALTER TABLE jobs ADD COLUMN workers_info TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE staff ADD COLUMN password_hash TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE staff ADD COLUMN password_salt TEXT");
} catch (e) {}
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      technician_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      otp_code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      is_verified INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone);
    CREATE INDEX IF NOT EXISTS idx_otp_code ON otp_verifications(otp_code);
  `);
} catch (e) {}
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      session_token TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      device_info TEXT,
      last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
  `);
} catch (e) {}

// Seed default passwords for staff without password_hash
try {
  const staffWithoutPassword = db.prepare("SELECT id, username, role FROM staff WHERE password_hash IS NULL OR password_hash = ''").all();
  if (staffWithoutPassword && staffWithoutPassword.length > 0) {
    const updateStmt = db.prepare("UPDATE staff SET password_hash = ?, password_salt = ? WHERE id = ?");
    for (const s of staffWithoutPassword) {
      let plainPass = 'tech123';
      if (s.role === 'ADMIN') plainPass = 'admin123';
      else if (s.role === 'MANAGER') plainPass = 'manager123';
      else if (s.role === 'SUPERVISOR') plainPass = 'supervisor123';
      else if (s.role === 'SALESMAN') plainPass = 'sales123';
      else if (s.role === 'TECHNICIAN') plainPass = 'tech123';

      const salt = generateSalt();
      const hash = hashPassword(plainPass, salt);
      updateStmt.run(hash, salt, s.id);
    }
  }
} catch (e) {
  console.error('[DB] Error migrating staff passwords:', e);
}

// Seed default treatments if empty
const treatmentCount = db.prepare('SELECT COUNT(*) as count FROM treatments').get().count;
if (treatmentCount === 0) {
  const defaultTreatments = [
    { code: 'GPC', name: 'General Pest Control', description: 'Cockroaches, ants, silverfish and general crawling insects', duration: 60, color: '#3B82F6' },
    { code: 'RC', name: 'Rodent Control', description: 'Rats, mice control using tamper-resistant bait stations', duration: 45, color: '#EF4444' },
    { code: 'MC', name: 'Mosquito Control', description: 'Thermal fogging, misting and larviciding treatment', duration: 45, color: '#10B981' },
    { code: 'FLY', name: 'Fly Control', description: 'Insect light traps, fly baiting and residual spraying', duration: 45, color: '#F59E0B' },
    { code: 'GPC/RC', name: 'General Pest & Rodent Control', description: 'Combined crawling insect & rodent eradication', duration: 90, color: '#8B5CF6' },
    { code: 'GPC/MC', name: 'General Pest & Mosquito Control', description: 'Combined crawling insect & mosquito eradication', duration: 90, color: '#06B6D4' },
    { code: 'GPC/RC/MC', name: 'GPC + Rodent + Mosquito Control', description: 'Triple comprehensive commercial treatment', duration: 120, color: '#EC4899' },
    { code: 'GPC/RC/FLY/MC', name: 'Full Spectrum Pest Control', description: 'Complete 4-in-1 integrated pest management service', duration: 150, color: '#6366F1' },
    { code: 'TERMITE', name: 'Termite Treatment', description: 'Subterranean termite post/pre-construction treatment', duration: 180, color: '#78350F' }
  ];

  const insertTreatment = db.prepare(`
    INSERT INTO treatments (code, name, description, default_duration_minutes, color_hex)
    VALUES (@code, @name, @description, @duration, @color)
  `);

  const tx = db.transaction(() => {
    for (const t of defaultTreatments) {
      insertTreatment.run(t);
    }
  });
  tx();
}

// Seed default staff if empty
const staffCount = db.prepare('SELECT COUNT(*) as count FROM staff').get().count;
if (staffCount === 0) {
  const defaultStaff = [
    { username: 'admin', full_name: 'System Admin', role: 'ADMIN', phone: '0771234567', email: 'admin@pestcontrol.lk' },
    { username: 'manager', full_name: 'Operations Manager', role: 'MANAGER', phone: '0772345678', email: 'manager@pestcontrol.lk' },
    { username: 'supervisor', full_name: 'Field Supervisor', role: 'SUPERVISOR', phone: '0773456789', email: 'supervisor@pestcontrol.lk' },
    { username: 'janadara', full_name: 'Janadara (Technician)', role: 'TECHNICIAN', phone: '0774567890', email: 'janadara@pestcontrol.lk' },
    { username: 'wasantha', full_name: 'Wasantha (Technician)', role: 'TECHNICIAN', phone: '0775678901', email: 'wasantha@pestcontrol.lk' },
    { username: 'wijenayaka', full_name: 'Wijenayaka (Technician)', role: 'TECHNICIAN', phone: '0776789012', email: 'wijenayaka@pestcontrol.lk' },
    { username: 'pubudu', full_name: 'Pubudu (Salesman)', role: 'SALESMAN', phone: '0777890123', email: 'pubudu@pestcontrol.lk' }
  ];

  const insertStaff = db.prepare(`
    INSERT INTO staff (username, full_name, role, phone, email)
    VALUES (@username, @full_name, @role, @phone, @email)
  `);

  const tx = db.transaction(() => {
    for (const s of defaultStaff) {
      insertStaff.run(s);
    }
  });
  tx();
}

// Seed default SMS settings if empty
const smsSettingsCount = db.prepare('SELECT COUNT(*) as count FROM sms_settings').get().count;
if (smsSettingsCount === 0) {
  db.prepare(`
    INSERT INTO sms_settings (id, provider, api_key, user_id, sender_id, is_simulation, is_active)
    VALUES (1, 'NOTIFY_LK', '', '', 'PESTCONTROL', 1, 1)
  `).run();
}

db.hashPassword = hashPassword;
db.generateSalt = generateSalt;

module.exports = db;
