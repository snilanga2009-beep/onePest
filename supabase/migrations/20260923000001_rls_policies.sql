-- ==============================================================================
-- Supabase Row Level Security (RLS) Policies
-- Multi-Role Access Control: ADMIN, MANAGER, SUPERVISOR, TECHNICIAN, PUBLIC
-- Idempotent & Safe to Re-run
-- ==============================================================================

-- Enable RLS across all application tables
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_backups ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR USER ROLES & SESSION EXTRACTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'role' IN ('service_role', 'ADMIN', 'MANAGER', 'SUPERVISOR')),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'staff_id')::BIGINT,
    (SELECT id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;

-- ------------------------------------------------------------------------------
-- 1. APP BRANDING (Public read for logo rendering across PWA, mobile & desktop)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read app branding" ON public.app_branding;
CREATE POLICY "Public read app branding"
  ON public.app_branding FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin write app branding" ON public.app_branding;
CREATE POLICY "Admin write app branding"
  ON public.app_branding FOR ALL
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- ------------------------------------------------------------------------------
-- 2. TREATMENTS (Public/authenticated read, Admin write)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read treatments" ON public.treatments;
CREATE POLICY "Read treatments"
  ON public.treatments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin manage treatments" ON public.treatments;
CREATE POLICY "Admin manage treatments"
  ON public.treatments FOR ALL
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- ------------------------------------------------------------------------------
-- 3. CUSTOMERS & LOCATIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read customers" ON public.customers;
CREATE POLICY "Read customers"
  ON public.customers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin manage customers" ON public.customers;
CREATE POLICY "Admin manage customers"
  ON public.customers FOR ALL
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Read locations" ON public.customer_locations;
CREATE POLICY "Read locations"
  ON public.customer_locations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin manage locations" ON public.customer_locations;
CREATE POLICY "Admin manage locations"
  ON public.customer_locations FOR ALL
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- ------------------------------------------------------------------------------
-- 4. JOBS (Admin full access; Technicians see and update their assigned jobs)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin manage all jobs" ON public.jobs;
CREATE POLICY "Admin manage all jobs"
  ON public.jobs FOR ALL
  USING (public.is_admin_or_manager() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin_or_manager() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Technician view assigned jobs" ON public.jobs;
CREATE POLICY "Technician view assigned jobs"
  ON public.jobs FOR SELECT
  USING (
    technician_id = public.current_staff_id() OR
    auth.role() = 'service_role' OR
    public.is_admin_or_manager()
  );

DROP POLICY IF EXISTS "Technician update assigned jobs" ON public.jobs;
CREATE POLICY "Technician update assigned jobs"
  ON public.jobs FOR UPDATE
  USING (
    technician_id = public.current_staff_id() OR
    auth.role() = 'service_role' OR
    public.is_admin_or_manager()
  )
  WITH CHECK (
    technician_id = public.current_staff_id() OR
    auth.role() = 'service_role' OR
    public.is_admin_or_manager()
  );

-- ------------------------------------------------------------------------------
-- 5. RECURRING SERVICES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin manage recurring services" ON public.recurring_services;
CREATE POLICY "Admin manage recurring services"
  ON public.recurring_services FOR ALL
  USING (public.is_admin_or_manager() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin_or_manager() OR auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 6. JOB PHOTOS & LOGS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read job photos" ON public.job_photos;
CREATE POLICY "Read job photos"
  ON public.job_photos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Insert job photos" ON public.job_photos;
CREATE POLICY "Insert job photos"
  ON public.job_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND (j.technician_id = public.current_staff_id() OR public.is_admin_or_manager())
    ) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Manage job logs" ON public.job_logs;
CREATE POLICY "Manage job logs"
  ON public.job_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. TECHNICIAN DEVICES (FCM Push tokens per technician)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Manage technician devices" ON public.technician_devices;
CREATE POLICY "Manage technician devices"
  ON public.technician_devices FOR ALL
  USING (
    technician_id = public.current_staff_id() OR
    public.is_admin_or_manager() OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    technician_id = public.current_staff_id() OR
    public.is_admin_or_manager() OR
    auth.role() = 'service_role'
  );

-- ------------------------------------------------------------------------------
-- 8. NOTIFICATIONS & PUSH LOGS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "View notifications" ON public.notifications;
CREATE POLICY "View notifications"
  ON public.notifications FOR SELECT
  USING (
    target_user_id = public.current_staff_id() OR
    public.is_admin_or_manager() OR
    auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Manage notifications" ON public.notifications;
CREATE POLICY "Manage notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin_or_manager() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin_or_manager() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Manage push logs" ON public.push_notification_logs;
CREATE POLICY "Manage push logs"
  ON public.push_notification_logs FOR ALL
  USING (public.is_admin_or_manager() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin_or_manager() OR auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 9. STAFF & SESSIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff read access" ON public.staff;
CREATE POLICY "Staff read access"
  ON public.staff FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin manage staff" ON public.staff;
CREATE POLICY "Admin manage staff"
  ON public.staff FOR ALL
  USING (public.is_admin_or_manager() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin_or_manager() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Manage technician sessions" ON public.technician_sessions;
CREATE POLICY "Manage technician sessions"
  ON public.technician_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Manage otp verifications" ON public.otp_verifications;
CREATE POLICY "Manage otp verifications"
  ON public.otp_verifications FOR ALL
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 10. SMS SETTINGS & BACKUPS (Restricted to Admins and Serverless)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin manage sms settings" ON public.sms_settings;
CREATE POLICY "Admin manage sms settings"
  ON public.sms_settings FOR ALL
  USING (public.is_admin_or_manager() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin_or_manager() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admin manage database backups" ON public.database_backups;
CREATE POLICY "Admin manage database backups"
  ON public.database_backups FOR ALL
  USING (public.is_admin_or_manager() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin_or_manager() OR auth.role() = 'service_role');
