-- Pest Control Master Scheduling System Schema
-- Timezone: Asia/Colombo

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MANAGER', 'SUPERVISOR', 'TECHNICIAN', 'SALESMAN')),
  phone TEXT,
  email TEXT,
  password_hash TEXT,
  password_salt TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treatments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_duration_minutes INTEGER DEFAULT 60,
  color_hex TEXT DEFAULT '#10B981',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  location TEXT,
  latitude REAL,
  longitude REAL,
  special_instructions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS customer_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  address TEXT,
  latitude REAL,
  longitude REAL,
  contact_person TEXT,
  phone TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_customer ON customer_locations(customer_id);

CREATE TABLE IF NOT EXISTS recurring_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES customer_locations(id) ON DELETE SET NULL,
  treatment_id INTEGER NOT NULL REFERENCES treatments(id),
  frequency TEXT NOT NULL CHECK(frequency IN ('DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY', '3 MONTHLY', 'CUSTOM')),
  preferred_day TEXT,
  preferred_time TEXT,
  duration_minutes INTEGER DEFAULT 60,
  technician_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  salesman_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  last_service_date TEXT,
  next_service_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PAUSED', 'CANCELLED')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_customer ON recurring_services(customer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_services(next_service_date);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_code TEXT UNIQUE NOT NULL,
  recurring_service_id INTEGER REFERENCES recurring_services(id) ON DELETE SET NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  location_id INTEGER REFERENCES customer_locations(id),
  treatment_id INTEGER NOT NULL REFERENCES treatments(id),
  technician_id INTEGER REFERENCES staff(id),
  salesman_id INTEGER REFERENCES staff(id),
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT,
  duration_minutes INTEGER DEFAULT 60,
  crew_count INTEGER DEFAULT 1,
  workers_info TEXT,
  status TEXT NOT NULL DEFAULT 'TO_BE_DONE' CHECK(status IN ('TO_BE_DONE', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED')),
  actual_start_time DATETIME,
  actual_end_time DATETIME,
  technician_notes TEXT,
  customer_signature TEXT,
  customer_confirmation_status TEXT DEFAULT 'UNCONFIRMED' CHECK(customer_confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'RESCHEDULE_REQUESTED')),
  reschedule_reason TEXT,
  postponed_to_date TEXT,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_recurring_date ON jobs(recurring_service_id, scheduled_date) WHERE recurring_service_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS job_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT DEFAULT 'COMPLETION',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by_id INTEGER REFERENCES staff(id),
  notes TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  target_role TEXT,
  target_user_id INTEGER REFERENCES staff(id),
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sms_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL DEFAULT 'TEXT_LK',
  api_key TEXT,
  api_token TEXT,
  user_id TEXT,
  sender_id TEXT DEFAULT 'TextLKDemo',
  password TEXT,
  endpoint_url TEXT,
  system_url TEXT DEFAULT '',
  is_simulation INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  recipient_name TEXT,
  message TEXT NOT NULL,
  gateway TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('SENT', 'SIMULATED', 'FAILED')),
  cost_lkr REAL DEFAULT 0.0,
  response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_job ON sms_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(phone);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at);

-- Web Push Notification VAPID Keys
CREATE TABLE IF NOT EXISTS push_vapid_keys (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Registered Technician Devices for Web Push
CREATE TABLE IF NOT EXISTS technician_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  technician_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT,
  browser TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tech_devices_tech ON technician_devices(technician_id);
CREATE INDEX IF NOT EXISTS idx_tech_devices_endpoint ON technician_devices(endpoint);

-- Push Notification Dispatch Audit Logs
CREATE TABLE IF NOT EXISTS push_notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  technician_id INTEGER,
  device_id TEXT,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_payload TEXT,
  status TEXT NOT NULL, -- 'SENT', 'FAILED'
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_logs_tech ON push_notification_logs(technician_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_created ON push_notification_logs(created_at);

-- Technician 1-Time Phone Login Persistent Sessions
CREATE TABLE IF NOT EXISTS technician_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  technician_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  device_info TEXT,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tech_sessions_token ON technician_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_tech_sessions_tech ON technician_sessions(technician_id);

-- One-Time SMS Verification Codes for Technicians
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

-- Universal User Sessions for All Roles (ADMIN, MANAGER, SUPERVISOR, TECHNICIAN, SALESMAN)
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


