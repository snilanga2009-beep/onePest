-- ==============================================================================
-- Supabase Seed Data: Default Treatments, Branding & Initial Admin
-- ==============================================================================

-- 1. Default Branding Setup
INSERT INTO public.app_branding (id, main_logo_type, main_logo_preset, main_logo_custom_url, app_icon_type, app_icon_custom_url, company_title, tagline)
VALUES (
  1,
  'PRESET',
  'ShieldCheck',
  '',
  'DEFAULT',
  '',
  'Ceylon Pest Management Solutions',
  'Professional Pest Control & Hygiene Management'
) ON CONFLICT (id) DO NOTHING;

-- 2. Core Pest Control Treatment Types
INSERT INTO public.treatments (code, name, description, default_duration_minutes, color_hex, is_active)
VALUES
  ('GPC', 'General Pest & Cockroach Control', 'Comprehensive interior and exterior barrier treatment for cockroaches and common insects.', 60, '#10B981', 1),
  ('TC', 'Termite Treatment & Inspection', 'Deep chemical soil barrier injection and wood structural treatment against subterranean termites.', 120, '#F59E0B', 1),
  ('RC', 'Rodent Control & Baiting', 'Installation and servicing of tamper-resistant rat bait stations and traps.', 45, '#EF4444', 1),
  ('BC', 'Bed Bug Heat & Residual Spray', 'Targeted eradication of bed bug infestations in mattresses, furniture and crevices.', 90, '#8B5CF6', 1),
  ('MC', 'Mosquito Thermal Fogging & Larvicide', 'Thermal fogging and larvicide application for outdoor perimeter and drainage basins.', 60, '#06B6D4', 1),
  ('FUM', 'Commercial Warehouse Fumigation', 'High-grade commercial phosphine / gas fumigation for bulk commodities and storage warehouses.', 180, '#64748B', 1)
ON CONFLICT (code) DO NOTHING;

-- 3. Default SMS Gateway Settings (Text.lk Sri Lanka)
INSERT INTO public.sms_settings (id, provider, api_key, api_token, user_id, sender_id, password, endpoint_url, system_url, is_simulation, is_active)
VALUES (
  1,
  'TEXT_LK',
  '',
  '',
  '',
  'TextLKDemo',
  '',
  'https://app.text.lk/api/v3/sms/send',
  '',
  1,
  1
) ON CONFLICT (id) DO NOTHING;

-- 4. Default Admin & Staff Accounts
-- Password for initial admin is 'admin123'
INSERT INTO public.staff (username, full_name, role, phone, email, password_hash, password_salt, is_active)
VALUES
  ('admin', 'Head Administrator', 'ADMIN', '+94771234567', 'admin@pestcontrol.lk', 'c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd472634dfac71cd34ebc35d16ab7fb8a90c81f975113d6c7538dc69dd8de9077ec', 's12345', 1),
  ('manager', 'Operations Manager', 'MANAGER', '+94772345678', 'manager@pestcontrol.lk', 'c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd472634dfac71cd34ebc35d16ab7fb8a90c81f975113d6c7538dc69dd8de9077ec', 's12345', 1),
  ('tech1', 'Sunil Perera (Lead Technician)', 'TECHNICIAN', '+94773456789', 'sunil@pestcontrol.lk', 'c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd472634dfac71cd34ebc35d16ab7fb8a90c81f975113d6c7538dc69dd8de9077ec', 's12345', 1),
  ('tech2', 'Kamal Silva (Field Technician)', 'TECHNICIAN', '+94774567890', 'kamal@pestcontrol.lk', 'c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd472634dfac71cd34ebc35d16ab7fb8a90c81f975113d6c7538dc69dd8de9077ec', 's12345', 1)
ON CONFLICT (username) DO NOTHING;
