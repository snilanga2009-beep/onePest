const { createClient } = require('@supabase/supabase-js');
const db = require('../server/db');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mabwkgcujnxiwlawpoph.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hYndrZ2N1am54aXdsYXdwb3BoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE2NjQ1MiwiZXhwIjoyMTA1NzQyNDUyfQ.hGrrjJOqQBqGTxiIRmP-HMz_OyE4C2Gqh15G38IMaMI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeDate(d) {
  if (!d) return null;
  const parts = String(d).trim().split('-');
  if (parts.length === 3) {
    let y = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let day = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
      if (m < 1) m = 1;
      if (m > 12) m = 12;
      const maxDays = new Date(y, m, 0).getDate();
      if (day > maxDays) day = maxDays;
      if (day < 1) day = 1;
      return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return d;
}

async function syncAll() {
  console.log('🔄 Starting improved data sync from SQLite to Supabase...');

  // 1. Sync Staff
  const staff = db.prepare('SELECT * FROM staff').all();
  console.log(`Syncing ${staff.length} staff members...`);
  for (const s of staff) {
    const { error } = await supabase.from('staff').upsert({
      id: s.id,
      username: s.username,
      full_name: s.full_name,
      role: s.role,
      phone: s.phone,
      email: s.email,
      password_hash: s.password_hash,
      password_salt: s.password_salt,
      is_active: s.is_active || 1
    }, { onConflict: 'id' });
    if (error) console.error('Staff sync error:', s.username, error.message);
  }
  console.log('✅ Staff synced.');

  // 2. Fetch all Supabase treatments to build mapping
  const { data: sbTreatments } = await supabase.from('treatments').select('id, code');
  const sbTreatmentByCode = new Map();
  sbTreatments.forEach(t => sbTreatmentByCode.set(t.code.toUpperCase(), t.id));

  const sqliteTreatments = db.prepare('SELECT * FROM treatments').all();
  const sqliteTreatmentById = new Map();
  sqliteTreatments.forEach(t => sqliteTreatmentById.set(t.id, t.code.toUpperCase()));

  // Map sqlite treatment ID -> supabase treatment ID
  function resolveTreatmentId(sqliteTid) {
    if (!sqliteTid) return sbTreatments[0]?.id || 1;
    const code = sqliteTreatmentById.get(sqliteTid);
    if (code && sbTreatmentByCode.has(code)) {
      return sbTreatmentByCode.get(code);
    }
    // Fallback: check if sqliteTid directly exists in Supabase
    const direct = sbTreatments.find(t => t.id === sqliteTid);
    if (direct) return direct.id;
    return sbTreatments[0]?.id || 1;
  }

  // 3. Sync Customers
  const customers = db.prepare('SELECT * FROM customers').all();
  console.log(`Syncing ${customers.length} customers in batches...`);
  const batchSize = 50;
  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize).map(c => ({
      id: c.id,
      customer_code: c.customer_code,
      name: c.name,
      contact_person: c.contact_person,
      phone: c.phone,
      email: c.email,
      address: c.address,
      location: c.location,
      latitude: c.latitude,
      longitude: c.longitude,
      special_instructions: c.special_instructions,
      is_active: c.is_active || 1
    }));
    const { error } = await supabase.from('customers').upsert(batch, { onConflict: 'id' });
    if (error) console.error(`Customer batch ${i} error:`, error.message);
  }
  console.log('✅ Customers synced.');

  // 4. Sync Customer Locations
  const locations = db.prepare('SELECT * FROM customer_locations').all();
  if (locations.length > 0) {
    console.log(`Syncing ${locations.length} customer locations...`);
    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize).map(l => ({
        id: l.id,
        customer_id: l.customer_id,
        location_name: l.location_name,
        address: l.address,
        latitude: l.latitude,
        longitude: l.longitude,
        contact_person: l.contact_person,
        phone: l.phone,
        is_primary: l.is_primary || 0
      }));
      const { error } = await supabase.from('customer_locations').upsert(batch, { onConflict: 'id' });
      if (error) console.error(`Location batch ${i} error:`, error.message);
    }
    console.log('✅ Customer locations synced.');
  }

  // 5. Sync Recurring Services
  const recurring = db.prepare('SELECT * FROM recurring_services').all();
  const validRecurringIds = new Set();
  if (recurring.length > 0) {
    console.log(`Syncing ${recurring.length} recurring services...`);
    for (let i = 0; i < recurring.length; i += batchSize) {
      const batch = recurring.slice(i, i + batchSize).map(r => {
        const nextDate = normalizeDate(r.next_service_date) || '2026-10-01';
        const lastDate = normalizeDate(r.last_service_date);
        return {
          id: r.id,
          customer_id: r.customer_id,
          location_id: r.location_id,
          treatment_id: resolveTreatmentId(r.treatment_id),
          frequency: r.frequency,
          preferred_day: r.preferred_day,
          preferred_time: r.preferred_time,
          duration_minutes: r.duration_minutes || 60,
          technician_id: r.technician_id,
          salesman_id: r.salesman_id,
          last_service_date: lastDate,
          next_service_date: nextDate,
          status: r.status || 'ACTIVE',
          notes: r.notes
        };
      });
      const { data, error } = await supabase.from('recurring_services').upsert(batch, { onConflict: 'id' }).select('id');
      if (error) {
        console.error(`Recurring batch ${i} error:`, error.message);
      } else if (data) {
        data.forEach(d => validRecurringIds.add(d.id));
      }
    }
    console.log(`✅ Recurring services synced (${validRecurringIds.size} confirmed).`);
  }

  // If set is empty from select, fetch all recurring ids from supabase
  if (validRecurringIds.size === 0) {
    const { data: allR } = await supabase.from('recurring_services').select('id');
    allR?.forEach(r => validRecurringIds.add(r.id));
  }

  // 6. Sync Jobs
  const jobs = db.prepare('SELECT * FROM jobs').all();
  console.log(`Syncing ${jobs.length} jobs in batches...`);
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize).map(j => {
      const scheduledDate = normalizeDate(j.scheduled_date) || '2026-10-01';
      const postponedDate = normalizeDate(j.postponed_to_date);
      const recurringId = validRecurringIds.has(j.recurring_service_id) ? j.recurring_service_id : null;
      return {
        id: j.id,
        job_code: j.job_code,
        recurring_service_id: recurringId,
        customer_id: j.customer_id,
        location_id: j.location_id,
        treatment_id: resolveTreatmentId(j.treatment_id),
        technician_id: j.technician_id,
        salesman_id: j.salesman_id,
        scheduled_date: scheduledDate,
        scheduled_time: j.scheduled_time,
        duration_minutes: j.duration_minutes || 60,
        status: j.status || 'TO_BE_DONE',
        actual_start_time: j.actual_start_time,
        actual_end_time: j.actual_end_time,
        technician_notes: j.technician_notes,
        customer_signature: j.customer_signature,
        customer_confirmation_status: j.customer_confirmation_status,
        reschedule_reason: j.reschedule_reason,
        postponed_to_date: postponedDate,
        completed_at: j.completed_at,
        crew_count: j.crew_count || 1,
        workers_info: j.workers_info
      };
    });
    const { error } = await supabase.from('jobs').upsert(batch, { onConflict: 'id' });
    if (error) console.error(`Job batch ${i} error:`, error.message);
  }
  console.log('✅ Jobs synced.');

  // 7. Verify stats
  const { count: cCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  const { count: jCount } = await supabase.from('jobs').select('*', { count: 'exact', head: true });
  const { count: sCount } = await supabase.from('staff').select('*', { count: 'exact', head: true });
  const { count: rCount } = await supabase.from('recurring_services').select('*', { count: 'exact', head: true });
  console.log(`\n🎉 SYNC COMPLETED SUCCESSFULLY!`);
  console.log(`Supabase Live Stats: Customers = ${cCount}, Recurring = ${rCount}, Jobs = ${jCount}, Staff = ${sCount}`);
}

syncAll().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
