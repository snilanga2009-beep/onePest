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

function cleanName(n) {
  if (!n) return '';
  return n.trim().replace(/^['",\s]+|['",\s]+$/g, '');
}

async function runFreshImport() {
  console.log('🚀 Starting fresh job data import from raw schedule...');

  // 1. Fetch reference data (Staff & Treatments)
  const [{ data: staffList }, { data: treatmentsList }] = await Promise.all([
    supabase.from('staff').select('id, full_name, role'),
    supabase.from('treatments').select('id, code, name')
  ]);

  console.log(`Loaded ${staffList?.length || 0} staff and ${treatmentsList?.length || 0} treatments.`);

  const treatmentMap = new Map();
  (treatmentsList || []).forEach(t => {
    treatmentMap.set(t.code.toUpperCase(), t.id);
  });

  const staffMap = new Map();
  (staffList || []).forEach(s => {
    staffMap.set(s.full_name.toLowerCase(), s.id);
  });

  function resolveStaff(name) {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    for (const [k, v] of staffMap.entries()) {
      if (k.includes(lower) || lower.includes(k)) return v;
    }
    // Match common salesman/tech aliases
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
      if (cleaned.includes(k)) return id;
    }
    return treatmentsList?.[0]?.id || 1;
  }

  // 2. Parse CSV
  const csvContent = fs.readFileSync('data/fresh_schedule.csv', 'utf8');
  const lines = csvContent.split(/\r?\n/);

  const parsedJobs = [];
  const customerSet = new Map(); // name -> { name, location, phone, contact_person }

  // Simple CSV line parser handling quotes
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

  const currentYearMonth = '2026-09';
  const todayDateStr = '2026-09-24';
  const tomorrowDateStr = '2026-09-25';

  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.includes('MONTHLEY TREATMENTS') || line.includes('MONTHLY TREATMENTS')) {
      currentSection = 'MONTHLY';
      continue;
    } else if (line.includes('WEEKLEY TREATMENTS') || line.includes('WEEKLY TREATMENTS')) {
      currentSection = 'WEEKLY';
      continue;
    } else if (line.includes('DAILY OPARATIONS') || line.includes('DAILY OPAARATIONS')) {
      currentSection = 'DAILY';
      continue;
    } else if (line.includes('ON REQUEST')) {
      currentSection = 'ON_REQUEST';
      continue;
    } else if (line.includes('HNB') || line.includes('ZONE')) {
      currentSection = 'HNB';
      continue;
    } else if (line.includes('ADHOC')) {
      currentSection = 'ADHOC';
      continue;
    }

    const cols = parseCSVLine(line);
    if (cols.length < 3) continue;

    // Detect if this is a customer row
    // Different sections have client at index 1 or 2
    let clientName = '';
    let treatmentStr = '';
    let locationStr = '';
    let phoneStr = '';
    let salesmanStr = '';
    let datesList = [];
    let frequency = 'Monthly';

    // Format A: Index-based: Number, Client, Status, Dates, Treatment, Location...
    // e.g. "1,AMAGI FOODS PVT LTD,DONE,16,13 (2.00 PM),GPC/RC/FLY/MC,EKALA,0770899800 (SHIVANTHI)..."
    // or ",ARRANGED,SPECTRA LOGISTICS,GPC/RC/MC,DC,,Monthly..."
    if (cols[0] === '' && (cols[1] === 'ARRANGED' || cols[1] === 'TO BE' || cols[1] === 'DONE')) {
      clientName = cols[2];
      treatmentStr = cols[3];
      locationStr = cols[4];
      phoneStr = cols[5];
      frequency = cols[6] || (currentSection === 'DAILY' ? 'Daily' : currentSection === 'WEEKLY' ? 'Weekly' : 'Monthly');
      salesmanStr = cols[9];

      // Check day columns 10..39 (days 1 to 30)
      for (let day = 1; day <= 30; day++) {
        const colIdx = 9 + day;
        if (colIdx < cols.length) {
          const val = cols[colIdx];
          if (val === '✅' || val === '❎' || val === 'KANDY' || val === 'KTN' || val === 'KTW' || val === 'KND' || val.includes(':')) {
            datesList.push(day);
          }
        }
      }
    } else if (/^\d+$/.test(cols[0]) && cols[1] && !cols[1].includes('MANULAS') && !cols[1].includes('PRO PEST')) {
      // e.g. "1,ALIYA LOUNGE,ARRANGED,"2,9,16,23,30","6,13,20,27",OK,GPC/RC,COLOMBO,717400902,Weekly..."
      clientName = cols[1];
      // Search for dates column (contains numbers like "5,12,19,27" or "16" or single day)
      for (let c = 2; c < Math.min(cols.length, 7); c++) {
        const val = cols[c];
        if (val && /\b\d{1,2}\b/.test(val) && !val.includes('GPC') && !val.includes('MC') && !val.includes('RC')) {
          const matches = val.match(/\b\d{1,2}\b/g);
          if (matches) {
            matches.forEach(m => {
              const dNum = parseInt(m, 10);
              if (dNum >= 1 && dNum <= 31) datesList.push(dNum);
            });
          }
        }
        if (val && (val.includes('GPC') || val.includes('RC') || val.includes('MC') || val.includes('FLY') || val.includes('TC') || val.includes('BEDBUG') || val.includes('TERMITE'))) {
          treatmentStr = val;
        }
      }

      // Find location and phone
      for (let c = 4; c < cols.length; c++) {
        const val = cols[c];
        if (!phoneStr && /\d{7,10}/.test(val)) {
          phoneStr = val;
        } else if (!locationStr && val && !val.includes('Monthly') && !val.includes('Weekly') && !val.includes('Daily') && val.length > 2 && isNaN(val)) {
          locationStr = val;
        }
        if (cols[c] === 'Monthly' || cols[c] === 'Weekly' || cols[c] === 'Daily' || cols[c] === 'FORTNIGHTY' || cols[c] === 'Fortnightly') {
          frequency = cols[c];
        }
      }
      salesmanStr = cols[cols.length - 1];
    } else if (cols[1] && (cols[1].includes('Hospital') || cols[1].includes('Branch') || cols[1].includes('Pettah') || cols[1].includes('Street'))) {
      // HNB style: 1,City Office Branch,DONE,18,22,GPC/RC
      clientName = `HNB - ${cols[1]}`;
      treatmentStr = cols[5] || 'GPC/RC';
      locationStr = cols[7] || 'Colombo';
      if (cols[3]) {
        const matches = cols[3].match(/\b\d{1,2}\b/g);
        if (matches) matches.forEach(m => datesList.push(parseInt(m, 10)));
      }
      if (cols[4]) {
        const matches = cols[4].match(/\b\d{1,2}\b/g);
        if (matches) matches.forEach(m => datesList.push(parseInt(m, 10)));
      }
    }

    clientName = cleanName(clientName);
    if (!clientName || clientName === 'CLIENT' || clientName.length < 2) continue;

    // Track customer
    if (!customerSet.has(clientName)) {
      customerSet.set(clientName, {
        name: clientName,
        location: locationStr || 'Colombo',
        phone: phoneStr ? phoneStr.replace(/[^0-9]/g, '') : '',
        contact_person: phoneStr && phoneStr.includes('(') ? phoneStr.split('(')[1].replace(')', '') : ''
      });
    }

    // Default dates if none parsed
    if (currentSection === 'DAILY' || frequency.toLowerCase() === 'daily') {
      // Daily: runs all 30 days
      datesList = Array.from({ length: 30 }, (_, d) => d + 1);
    } else if (datesList.length === 0) {
      if (frequency.toLowerCase().includes('week')) {
        datesList = [4, 11, 18, 25];
      } else {
        // Deterministic hash based on name length for well-distributed monthly service day
        const day = (clientName.length * 7) % 28 + 1;
        datesList = [day];
      }
    }

    datesList = [...new Set(datesList)].filter(d => d >= 1 && d <= 30);

    for (const dayNum of datesList) {
      const scheduledDate = `${currentYearMonth}-${String(dayNum).padStart(2, '0')}`;
      let status = 'TO_BE_DONE';
      if (scheduledDate < todayDateStr) {
        status = 'COMPLETED';
      } else if (scheduledDate === todayDateStr) {
        status = 'TO_BE_DONE';
      } else {
        status = 'TO_BE_DONE';
      }

      parsedJobs.push({
        clientName,
        treatmentCode: treatmentStr || 'GPC/RC',
        locationName: locationStr || 'Colombo',
        scheduledDate,
        scheduledTime: '09:00',
        durationMinutes: 60,
        salesmanName: salesmanStr,
        status,
        customerPhone: phoneStr
      });
    }
  }

  console.log(`Parsed ${customerSet.size} unique customers and ${parsedJobs.length} scheduled jobs.`);

  // 3. Clear ALL current jobs from Supabase
  console.log('🧹 Clearing all existing jobs in Supabase...');
  const { error: delError } = await supabase.from('jobs').delete().neq('id', 0);
  if (delError) {
    console.error('Error clearing jobs:', delError);
    return;
  }
  console.log('✅ All existing jobs deleted from Supabase.');

  // 4. Upsert Customers & Locations
  console.log('🏢 Upserting customers...');
  const existingCustomersRes = await supabase.from('customers').select('id, name');
  const existingCustomerMap = new Map();
  (existingCustomersRes.data || []).forEach(c => existingCustomerMap.set(c.name.toLowerCase().trim(), c.id));

  let nextCustNum = 350;
  for (const [custName, custData] of customerSet.entries()) {
    const key = custName.toLowerCase().trim();
    if (!existingCustomerMap.has(key)) {
      const assignedId = nextCustNum++;
      const { data: newCust, error: cErr } = await supabase.from('customers').insert({
        id: assignedId,
        customer_code: `CUST-${assignedId}`,
        name: custData.name,
        phone: custData.phone || '0770000000',
        contact_person: custData.contact_person || '',
        address: custData.location || 'Colombo',
        location: custData.location || 'Colombo',
        is_active: 1
      }).select('id').single();

      if (newCust) {
        existingCustomerMap.set(key, newCust.id);
      } else if (cErr) {
        console.warn(`Customer insert warning for ${custName}:`, cErr.message);
      }
    }
  }

  // Fetch all customer IDs
  const allCustRes = await supabase.from('customers').select('id, name');
  allCustRes.data?.forEach(c => existingCustomerMap.set(c.name.toLowerCase().trim(), c.id));

  // 5. Ensure locations
  const { data: existingLocs } = await supabase.from('customer_locations').select('id, customer_id, location_name');
  const locationMap = new Map(); // customer_id -> locId
  existingLocs?.forEach(l => locationMap.set(l.customer_id, l.id));

  let nextLocId = 500;
  for (const [key, custId] of existingCustomerMap.entries()) {
    if (!locationMap.has(custId)) {
      const { data: newLoc } = await supabase.from('customer_locations').insert({
        id: nextLocId++,
        customer_id: custId,
        location_name: 'Main Location',
        address: 'Colombo',
        is_primary: 1
      }).select('id').single();
      if (newLoc) locationMap.set(custId, newLoc.id);
    }
  }

  // 6. Insert Fresh Jobs in Batches
  console.log(`📥 Inserting ${parsedJobs.length} fresh jobs into Supabase...`);
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < parsedJobs.length; i += batchSize) {
    const slice = parsedJobs.slice(i, i + batchSize);
    const jobBatch = slice.map((pj, idx) => {
      const custId = existingCustomerMap.get(pj.clientName.toLowerCase().trim()) || existingCustomerMap.values().next().value || 1;
      const locId = locationMap.get(custId) || null;
      const treatId = resolveTreatment(pj.treatmentCode);
      const techId = resolveStaff(pj.salesmanName);
      const codeNum = i + idx + 1001;

      return {
        job_code: `JOB-${codeNum}`,
        customer_id: custId,
        location_id: locId,
        treatment_id: treatId,
        technician_id: techId,
        scheduled_date: pj.scheduledDate,
        scheduled_time: pj.scheduledTime,
        duration_minutes: pj.durationMinutes,
        status: pj.status,
        customer_confirmation_status: pj.status === 'COMPLETED' ? 'CONFIRMED' : 'UNCONFIRMED',
        crew_count: 1
      };
    });

    const { error: insError } = await supabase.from('jobs').insert(jobBatch);
    if (insError) {
      console.error(`Batch ${i} error:`, insError.message);
    } else {
      inserted += jobBatch.length;
    }
  }

  console.log(`🎉 Successfully inserted ${inserted} fresh jobs!`);

  // Verify today and tomorrow counts
  const { count: todayCount } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('scheduled_date', todayDateStr);
  const { count: tomorrowCount } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('scheduled_date', tomorrowDateStr);
  const { count: totalJobs } = await supabase.from('jobs').select('id', { count: 'exact', head: true });

  console.log('--------------------------------------------------');
  console.log(`📊 Fresh System Stats:`);
  console.log(`📅 Today's Jobs (${todayDateStr}): ${todayCount}`);
  console.log(`📅 Tomorrow's Jobs (${tomorrowDateStr}): ${tomorrowCount}`);
  console.log(`📦 Total Jobs in System: ${totalJobs}`);
  console.log('--------------------------------------------------');
}

runFreshImport().catch(err => {
  console.error('Fatal error during fresh import:', err);
  process.exit(1);
});
