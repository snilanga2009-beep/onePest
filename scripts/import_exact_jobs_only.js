const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mabwkgcujnxiwlawpoph.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result.map(s => s.trim().replace(/^"|"$/g, ''));
}

function extractDayNumbers(str) {
  if (!str) return [];
  const days = [];
  if (/\d{4}-\d{2}-\d{2}/.test(str)) {
    const m = str.match(/\d{4}-\d{2}-(\d{2})/);
    if (m) days.push(parseInt(m[1], 10));
    return days;
  }
  const parts = str.split(/[,;&\/]|\band\b/i);
  for (const part of parts) {
    const m = part.match(/\b([1-9]|[12][0-9]|3[01])\b/);
    if (m) {
      const d = parseInt(m[1], 10);
      if (d >= 1 && d <= 31) days.push(d);
    }
  }
  return [...new Set(days)];
}

const statusWords = new Set(['arranged', 'done', 'to be', 'to be done', 'to be - done', 'finished', 'postponed', 'dropped', 'droped', 'pending', 'job is done', 'ok']);
function isClientName(str) {
  if (!str || str.length < 2) return false;
  const lower = str.toLowerCase().trim();
  if (statusWords.has(lower)) return false;
  if (lower === 'client' || lower.includes('oparation') || lower.includes('treatment') || lower.includes('branch')) return false;
  if (!isNaN(str)) return false;
  return true;
}

async function runExactImport() {
  console.log('🚀 Loading reference data from Supabase...');
  const [{ data: staffList }, { data: treatmentsList }] = await Promise.all([
    supabase.from('staff').select('id, full_name, role'),
    supabase.from('treatments').select('id, code, name')
  ]);

  console.log(`Loaded ${staffList?.length || 0} staff and ${treatmentsList?.length || 0} treatments.`);

  const treatmentMap = new Map();
  (treatmentsList || []).forEach(t => {
    treatmentMap.set(t.code.toUpperCase().replace(/\s+/g, ''), t.id);
  });

  const staffMap = new Map();
  (staffList || []).forEach(s => {
    staffMap.set(s.full_name.toLowerCase().trim(), s.id);
  });

  function resolveStaff(name) {
    if (!name) return staffList?.[0]?.id || null;
    const lower = name.toLowerCase().trim();
    for (const [k, v] of staffMap.entries()) {
      if (k.includes(lower) || lower.includes(k)) return v;
    }
    if (lower.includes('wasan') || lower.includes('wasatha')) return staffMap.get('wasantha') || staffList?.[0]?.id;
    if (lower.includes('jana')) return staffMap.get('janadara') || staffList?.[0]?.id;
    if (lower.includes('pubu')) return staffMap.get('pubudu') || staffList?.[0]?.id;
    if (lower.includes('wije') || lower.includes('wijee') || lower.includes('wijenayaka')) return staffMap.get('wijenayaka') || staffMap.get('wije') || staffList?.[0]?.id;
    if (lower.includes('saman')) return staffMap.get('saman') || staffList?.[0]?.id;
    if (lower.includes('nuwan')) return staffMap.get('nuwantha') || staffList?.[0]?.id;
    if (lower.includes('suraj')) return staffMap.get('suraj') || staffList?.[0]?.id;
    return staffList?.[0]?.id || null;
  }

  function resolveTreatment(code) {
    if (!code) return treatmentsList?.[0]?.id || 1;
    const cleaned = code.toUpperCase().replace(/\s+/g, '');
    for (const [k, id] of treatmentMap.entries()) {
      if (cleaned.includes(k) || k.includes(cleaned)) return id;
    }
    // Generic fallbacks
    if (cleaned.includes('GPC')) return treatmentMap.get('GPC') || treatmentMap.get('GPC/RC') || 1;
    if (cleaned.includes('RC')) return treatmentMap.get('RC') || 1;
    if (cleaned.includes('MC')) return treatmentMap.get('MC') || 1;
    if (cleaned.includes('FLY')) return treatmentMap.get('FLY') || 1;
    return treatmentsList?.[0]?.id || 1;
  }

  const raw = fs.readFileSync('data/fresh_schedule.csv', 'utf8');
  const lines = raw.split(/\r?\n/);

  const rawJobs = [];
  const customerMap = new Map(); // normalized -> { name, location, phone }

  // --- Section 1: Matrix 1 (lines 0 to 223) ---
  for (let i = 0; i <= 223; i++) {
    const line = lines[i];
    if (!line || line.startsWith(',,,,') || line.includes('MONTHLEY') || line.includes('PRO PEST') || line.includes('WEEKLEY') || line.includes('DAILY')) continue;
    const cols = parseCSVLine(line);
    if (cols.length < 12) continue;

    const client = cols[2];
    if (!isClientName(client)) continue;
    const treatment = cols[3] || 'GPC/RC';
    const location = cols[4] || 'Colombo';
    const phone = cols[5] || '';
    const salesman = cols[9] || '';

    customerMap.set(client.toLowerCase().trim(), { name: client.trim(), location: location.trim(), phone: phone.trim() });

    for (let day = 1; day <= 30; day++) {
      const colIdx = 9 + day;
      if (colIdx < cols.length) {
        const val = cols[colIdx]?.trim();
        if (!val) continue;
        const isCheck = val === '✅' || val === '❎' || val.toLowerCase() === 'x';
        const isTimeOrAction = /\d{1,2}(:\d{2}|pm|am)/i.test(val) || val.toLowerCase() === 'fly' || val.toLowerCase() === 'termite' || val.toLowerCase() === 'full';
        if (isCheck || isTimeOrAction) {
          rawJobs.push({ client: client.trim(), treatment, location, phone, salesman, day, source: 'Matrix1' });
        }
      }
    }
  }

  // --- Section 2: Matrix 2 & Monthly/Weekly (lines 224 to 412) ---
  for (let i = 224; i <= 412; i++) {
    const line = lines[i];
    if (!line || line.startsWith(',,,,') || line.includes('OPARATIONS') || line.includes('TREATMENTS')) continue;
    const cols = parseCSVLine(line);
    if (cols.length < 5) continue;

    const client = cols[1];
    if (!isClientName(client)) continue;
    const dateCol = cols[3];
    const treatment = cols[4] || 'GPC/RC';
    const location = cols[5] || 'Colombo';
    const phone = cols[6] || '';
    const salesman = cols[10] || '';

    customerMap.set(client.toLowerCase().trim(), { name: client.trim(), location: location.trim(), phone: phone.trim() });

    const daysFromDate = extractDayNumbers(dateCol);
    for (const d of daysFromDate) {
      if (d >= 1 && d <= 30) {
        rawJobs.push({ client: client.trim(), treatment, location, phone, salesman, day: d, source: 'Matrix2-Date' });
      }
    }

    for (let day = 1; day <= 31; day++) {
      const colIdx = 10 + day;
      if (colIdx < cols.length) {
        const val = cols[colIdx]?.trim();
        if (!val) continue;
        const isCheck = val === '✅' || val === '❎' || val.toLowerCase() === 'x';
        const isTimeOrAction = /\d{1,2}(:\d{2}|pm|am)/i.test(val) || val.toLowerCase() === 'fly' || val.toLowerCase() === 'termite' || val.toLowerCase() === 'full';
        if (isCheck || isTimeOrAction) {
          rawJobs.push({ client: client.trim(), treatment, location, phone, salesman, day, source: 'Matrix2-Col' });
        }
      }
    }
  }

  // --- Section 3: Lines 413 to 601 (LAST DATE & CURRENT DATE) ---
  for (let i = 413; i <= 601; i++) {
    const line = lines[i];
    if (!line || line.startsWith(',,,,') || line.includes('OPARATIONS') || line.includes('TREATMENTS') || line.includes('BRANCHES') || line.includes('ADHOC')) continue;
    const cols = parseCSVLine(line);
    if (cols.length < 5) continue;

    const client = cols[1];
    if (!isClientName(client)) continue;
    const lastDate = cols[3];
    const currDate = cols[4];
    const treatment = cols[5] || cols[4] || 'GPC/RC';
    const location = cols[6] || cols[5] || 'Colombo';
    const phone = cols[7] || '';
    const salesman = cols[11] || '';

    customerMap.set(client.toLowerCase().trim(), { name: client.trim(), location: location.trim(), phone: phone.trim() });

    const days = [...new Set([...extractDayNumbers(currDate), ...extractDayNumbers(lastDate)])];
    for (const d of days) {
      if (d >= 1 && d <= 30) {
        rawJobs.push({ client: client.trim(), treatment, location, phone, salesman, day: d, source: 'Section3-Dates' });
      }
    }
  }

  // --- Section 4: Master Table MANULAS PEST OPARATIONS (lines 602 to 743) ---
  let startMaster = false;
  for (let i = 602; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.includes('MANULAS PEST OPARATIONS')) {
      startMaster = true;
      continue;
    }
    if (!startMaster) continue;
    if (line.startsWith(',,,,') || line.includes('OPARATIONS') || line.includes('TREATMENTS') || line.includes('HNB BRANCHES') || line.includes('ON REQUEST')) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 5) continue;

    const client = cols[1];
    if (!isClientName(client)) continue;
    const prevDate = cols[3];
    const nextDate = cols[4];
    const treatment = cols[6] || 'GPC/RC';
    const location = cols[7] || 'Colombo';
    const phone = cols[8] || '';
    const salesman = cols[12] || '';

    customerMap.set(client.toLowerCase().trim(), { name: client.trim(), location: location.trim(), phone: phone.trim() });

    const days = [...new Set([...extractDayNumbers(nextDate), ...extractDayNumbers(prevDate)])];
    for (const d of days) {
      if (d >= 1 && d <= 30) {
        rawJobs.push({ client: client.trim(), treatment, location, phone, salesman, day: d, source: 'MasterTable' });
      }
    }
  }

  // Deduplicate jobs by client + day
  const dedupMap = new Map();
  for (const j of rawJobs) {
    const norm = j.client.toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${norm}|${j.day}`;
    if (!dedupMap.has(key)) {
      dedupMap.set(key, j);
    } else {
      const existing = dedupMap.get(key);
      if (j.treatment.length > existing.treatment.length && !existing.treatment.includes('/')) {
        existing.treatment = j.treatment;
      }
      if (j.phone && !existing.phone) existing.phone = j.phone;
      if (j.location && j.location !== 'Colombo') existing.location = j.location;
      if (j.salesman && !existing.salesman) existing.salesman = j.salesman;
    }
  }

  const finalJobs = Array.from(dedupMap.values());
  console.log(`Parsed ${customerMap.size} unique customers and ${finalJobs.length} exact scheduled jobs.`);

  // 1. Clear ALL current jobs from Supabase
  console.log('🧹 Wiping all existing bloated jobs from Supabase...');
  const { error: delError } = await supabase.from('jobs').delete().neq('id', 0);
  if (delError) {
    console.error('Error clearing jobs:', delError);
    return;
  }
  console.log('✅ Supabase jobs table completely emptied.');

  // 2. Upsert Customers
  console.log('🏢 Upserting customers...');
  const existingCustRes = await supabase.from('customers').select('id, name');
  const custIdMap = new Map();
  (existingCustRes.data || []).forEach(c => custIdMap.set(c.name.toLowerCase().trim(), c.id));

  let nextCustId = 400;
  for (const [key, cust] of customerMap.entries()) {
    if (!custIdMap.has(key)) {
      const newId = nextCustId++;
      const { data: createdCust, error: cErr } = await supabase.from('customers').insert({
        id: newId,
        customer_code: `CUST-${newId}`,
        name: cust.name,
        phone: cust.phone || '0770000000',
        contact_person: '',
        address: cust.location || 'Colombo',
        location: cust.location || 'Colombo',
        is_active: 1
      }).select('id').single();

      if (createdCust) {
        custIdMap.set(key, createdCust.id);
      } else if (cErr) {
        // Find existing match by loose name
        for (const [ek, ev] of custIdMap.entries()) {
          if (ek.includes(key) || key.includes(ek)) {
            custIdMap.set(key, ev);
            break;
          }
        }
      }
    }
  }

  // Refresh customer IDs
  const allCusts = await supabase.from('customers').select('id, name');
  allCusts.data?.forEach(c => custIdMap.set(c.name.toLowerCase().trim(), c.id));

  // 3. Upsert Locations
  const { data: existingLocs } = await supabase.from('customer_locations').select('id, customer_id');
  const locMap = new Map();
  existingLocs?.forEach(l => locMap.set(l.customer_id, l.id));

  let nextLocId = 600;
  for (const [key, custId] of custIdMap.entries()) {
    if (!locMap.has(custId)) {
      const { data: newLoc } = await supabase.from('customer_locations').insert({
        id: nextLocId++,
        customer_id: custId,
        location_name: 'Main Location',
        address: 'Colombo',
        is_primary: 1
      }).select('id').single();
      if (newLoc) locMap.set(custId, newLoc.id);
    }
  }

  // 4. Batch Insert Exact Jobs
  console.log(`📥 Inserting ${finalJobs.length} exact operations jobs into Supabase...`);
  const todayDateStr = '2026-09-24';
  const tomorrowDateStr = '2026-09-25';
  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < finalJobs.length; i += batchSize) {
    const slice = finalJobs.slice(i, i + batchSize);
    const jobBatch = slice.map((j, idx) => {
      const custKey = j.client.toLowerCase().trim();
      let custId = custIdMap.get(custKey);
      if (!custId) {
        // Fallback search
        for (const [k, v] of custIdMap.entries()) {
          if (k.includes(custKey) || custKey.includes(k)) {
            custId = v;
            break;
          }
        }
      }
      if (!custId) custId = custIdMap.values().next().value || 1;

      const locId = locMap.get(custId) || null;
      const treatId = resolveTreatment(j.treatment);
      const techId = resolveStaff(j.salesman);
      const dateStr = `2026-09-${String(j.day).padStart(2, '0')}`;
      const status = dateStr < todayDateStr ? 'COMPLETED' : 'TO_BE_DONE';
      const codeNum = 2000 + i + idx;

      return {
        job_code: `JOB-${codeNum}`,
        customer_id: custId,
        location_id: locId,
        treatment_id: treatId,
        technician_id: techId,
        scheduled_date: dateStr,
        scheduled_time: '09:00',
        duration_minutes: 60,
        status,
        customer_confirmation_status: status === 'COMPLETED' ? 'CONFIRMED' : 'UNCONFIRMED',
        crew_count: 1
      };
    });

    const { error: insErr } = await supabase.from('jobs').insert(jobBatch);
    if (insErr) {
      console.error(`Error inserting batch ${i}:`, insErr.message);
    } else {
      insertedCount += jobBatch.length;
    }
  }

  console.log(`🎉 Successfully loaded ${insertedCount} exact jobs into Supabase!`);

  // Verify Counts
  const { count: todayCount } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('scheduled_date', todayDateStr);
  const { count: tomorrowCount } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('scheduled_date', tomorrowDateStr);
  const { count: totalJobs } = await supabase.from('jobs').select('id', { count: 'exact', head: true });

  console.log('--------------------------------------------------');
  console.log(`📊 Exact Operations Stats:`);
  console.log(`📅 Today's Jobs (${todayDateStr}): ${todayCount}`);
  console.log(`📅 Tomorrow's Jobs (${tomorrowDateStr}): ${tomorrowCount}`);
  console.log(`📦 Total Jobs in System: ${totalJobs}`);
  console.log('--------------------------------------------------');
}

runExactImport().catch(err => {
  console.error('Fatal error during exact import:', err);
  process.exit(1);
});
