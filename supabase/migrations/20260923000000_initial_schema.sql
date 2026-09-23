-- ==============================================================================
-- Supabase PostgreSQL Schema: Pest Control Management & Technician PWA System
-- Timezone: Asia/Colombo
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. STAFF (Admins, Managers, Supervisors, Technicians, Salesmen)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'SUPERVISOR', 'TECHNICIAN', 'SALESMAN')),
  phone TEXT,
  email TEXT,
  password_hash TEXT,
  password_salt TEXT,
  auth_user_id UUID, -- Optional link to auth.users if Supabase Auth is enabled
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON public.staff(phone);
CREATE INDEX IF NOT EXISTS idx_staff_username ON public.staff(username);

-- ------------------------------------------------------------------------------
-- 2. TREATMENTS (Pest control formulas, durations & badge color tags)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treatments (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_duration_minutes INTEGER DEFAULT 60,
  color_hex TEXT DEFAULT '#10B981',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

-- ------------------------------------------------------------------------------
-- 3. CUSTOMERS & CUSTOMER LOCATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGSERIAL PRIMARY KEY,
  customer_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  special_instructions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers(customer_code);

CREATE TABLE IF NOT EXISTS public.customer_locations (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  contact_person TEXT,
  phone TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_locations_customer ON public.customer_locations(customer_id);

-- ------------------------------------------------------------------------------
-- 4. RECURRING SERVICES (Master schedule contracts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_services (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  location_id BIGINT REFERENCES public.customer_locations(id) ON DELETE SET NULL,
  treatment_id BIGINT NOT NULL REFERENCES public.treatments(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY', '3 MONTHLY', 'CUSTOM')),
  preferred_day TEXT,
  preferred_time TEXT,
  duration_minutes INTEGER DEFAULT 60,
  technician_id BIGINT REFERENCES public.staff(id) ON DELETE SET NULL,
  salesman_id BIGINT REFERENCES public.staff(id) ON DELETE SET NULL,
  last_service_date DATE,
  next_service_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_recurring_customer ON public.recurring_services(customer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON public.recurring_services(next_service_date);

-- ------------------------------------------------------------------------------
-- 5. JOBS (Operational Service Dispatches)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id BIGSERIAL PRIMARY KEY,
  job_code TEXT UNIQUE NOT NULL,
  recurring_service_id BIGINT REFERENCES public.recurring_services(id) ON DELETE SET NULL,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id),
  location_id BIGINT REFERENCES public.customer_locations(id),
  treatment_id BIGINT NOT NULL REFERENCES public.treatments(id),
  technician_id BIGINT REFERENCES public.staff(id),
  salesman_id BIGINT REFERENCES public.staff(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT,
  duration_minutes INTEGER DEFAULT 60,
  crew_count INTEGER DEFAULT 1,
  workers_info TEXT,
  status TEXT NOT NULL DEFAULT 'TO_BE_DONE' CHECK (status IN ('TO_BE_DONE', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED')),
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  technician_notes TEXT,
  customer_signature TEXT,
  customer_confirmation_status TEXT DEFAULT 'UNCONFIRMED' CHECK (customer_confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'RESCHEDULE_REQUESTED')),
  reschedule_reason TEXT,
  postponed_to_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON public.jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON public.jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON public.jobs(customer_id);

-- ------------------------------------------------------------------------------
-- 6. JOB PHOTOS & JOB LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_photos (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT DEFAULT 'COMPLETION',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_job_photos_job ON public.job_photos(job_id);

CREATE TABLE IF NOT EXISTS public.job_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by_id BIGINT REFERENCES public.staff(id),
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_job_logs_job ON public.job_logs(job_id);

-- ------------------------------------------------------------------------------
-- 7. NOTIFICATIONS & IN-APP ALERTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  target_role TEXT,
  target_user_id BIGINT REFERENCES public.staff(id),
  job_id BIGINT REFERENCES public.jobs(id) ON DELETE CASCADE,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_notifications_target ON public.notifications(target_user_id, is_read);

-- ------------------------------------------------------------------------------
-- 8. SRI LANKA SMS GATEWAY (Text.lk) & SMS LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_settings (
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
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES public.jobs(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  recipient_name TEXT,
  message TEXT NOT NULL,
  gateway TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT', 'SIMULATED', 'FAILED')),
  cost_lkr DOUBLE PRECISION DEFAULT 0.0,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_job ON public.sms_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON public.sms_logs(phone);

-- ------------------------------------------------------------------------------
-- 9. CUSTOM SYSTEM BRANDING & LOGOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_branding (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  main_logo_type TEXT DEFAULT 'PRESET',
  main_logo_preset TEXT DEFAULT 'ShieldCheck',
  main_logo_custom_url TEXT DEFAULT '',
  app_icon_type TEXT DEFAULT 'DEFAULT',
  app_icon_custom_url TEXT DEFAULT '',
  company_title TEXT DEFAULT 'Ceylon Pest Management Solutions',
  tagline TEXT DEFAULT 'Professional Pest Control & Hygiene Management',
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

-- ------------------------------------------------------------------------------
-- 10. FIREBASE CLOUD MESSAGING (FCM) & TECHNICIAN DEVICES (Multi-Device)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technician_devices (
  id BIGSERIAL PRIMARY KEY,
  technician_id BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  endpoint TEXT, -- Backwards compatible WebPush endpoint if applicable
  platform TEXT, -- Android, iOS, iPad, Desktop
  browser TEXT,  -- Chrome, Safari, Edge, Firefox
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW()),
  last_seen_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tech_devices_fcm ON public.technician_devices(fcm_token);
CREATE INDEX IF NOT EXISTS idx_tech_devices_tech ON public.technician_devices(technician_id);

CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id BIGSERIAL PRIMARY KEY,
  technician_id BIGINT,
  device_id TEXT,
  notification_type TEXT NOT NULL, -- NEW_JOB, JOB_UPDATED, JOB_REMINDER, JOB_CANCELLED, JOB_OVERDUE
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_payload JSONB,
  status TEXT NOT NULL, -- SENT, FAILED
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_push_logs_tech ON public.push_notification_logs(technician_id);

-- ------------------------------------------------------------------------------
-- 11. TECHNICIAN 1-TIME SMS OTP SESSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technician_sessions (
  id BIGSERIAL PRIMARY KEY,
  technician_id BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  device_info TEXT,
  last_active_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW()),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_tech_sessions_token ON public.technician_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_tech_sessions_tech ON public.technician_sessions(technician_id);

CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  technician_id BIGINT REFERENCES public.staff(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_verified INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_code ON public.otp_verifications(otp_code);

-- ------------------------------------------------------------------------------
-- 12. DATABASE BACKUPS METADATA (Tracking monthly and manual archives)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.database_backups (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT UNIQUE NOT NULL,
  filepath TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('MONTHLY_AUTO', 'MANUAL_INSTANT', 'PRE_RESTORE_SAFETY')),
  month_key TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Colombo', NOW())
);

-- Realtime publication for instantaneous frontend sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_notification_logs;
