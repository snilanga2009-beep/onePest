const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

async function run() {
  console.log('🔄 Linking jobs to recurring services and assigning real frequencies...');

  // 1. Build a client -> frequency map from the CSV
  const csvContent = fs.readFileSync('data/fresh_schedule.csv', 'utf8');
  const lines = csvContent.split(/\r?\n/);

  const clientFreqMap = new Map(); // normalized client -> frequency (DAILY, WEEKLY, FORTNIGHTLY, MONTHLY)

  let curSection = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.includes('DAILY OPARATIONS') || line.includes('DAILY OPAARATIONS')) curSection = 'DAILY';
    else if (line.includes('WEEKLEY TREATMENTS') || line.includes('WEEKLY TREATMENTS')) curSection = 'WEEKLY';
    else if (line.includes('MONTHLEY TREATMENTS') || line.includes('MONTHLY TREATMENTS')) curSection = 'MONTHLY';
    else if (line.includes('HNB BRANCHES')) curSection = 'MONTHLY';

    const cols = parseCSVLine(line);
    for (let c = 1; c <= 2; c++) {
      const name = cols[c]?.trim();
      if (name && name.length > 2 && isNaN(name) && !name.includes('TREATMENT') && !name.includes('OPARATION') && name !== 'CLIENT') {
        const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Explicit frequency column if present
        let freq = curSection || 'MONTHLY';
        const rawFreq = (cols[6] || cols[9] || '').toLowerCase();
        if (rawFreq.includes('daily')) freq = 'DAILY';
        else if (rawFreq.includes('fortnight')) freq = 'FORTNIGHTLY';
        else if (rawFreq.includes('week')) freq = 'WEEKLY';
        else if (rawFreq.includes('3 month')) freq = '3 MONTHLY';
        else if (rawFreq.includes('month')) freq = 'MONTHLY';

        clientFreqMap.set(norm, freq);
      }
    }
  }

  console.log(`Mapped frequencies for ${clientFreqMap.size} clients from CSV.`);

  // 2. Fetch all customers, treatments, existing recurring_services, and jobs
  const [
    { data: customers },
    { data: treatments },
    { data: existingRecs },
    { data: jobs }
  ] = await Promise.all([
    supabase.from('customers').select('id, name'),
    supabase.from('treatments').select('id, code'),
    supabase.from('recurring_services').select('id, customer_id, treatment_id, frequency'),
    supabase.from('jobs').select('id, customer_id, treatment_id')
  ]);

  console.log(`Loaded ${customers.length} customers, ${existingRecs.length} recurring services, and ${jobs.length} jobs.`);

  // Map customer_id -> normName
  const custIdToNorm = new Map();
  customers.forEach(c => {
    custIdToNorm.set(c.id, c.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  });

  // Map (customerId, treatmentId) -> recId
  const recMap = new Map();
  existingRecs.forEach(r => {
    recMap.set(`${r.customer_id}|${r.treatment_id}`, r.id);
    if (!recMap.has(`${r.customer_id}`)) {
      recMap.set(`${r.customer_id}`, r.id);
    }
  });

  // Find customers without a recurring_service and create one
  const missingCustIds = new Set();
  jobs.forEach(j => {
    if (!recMap.has(`${j.customer_id}`)) {
      missingCustIds.add(j.customer_id);
    }
  });

  console.log(`Creating recurring services for ${missingCustIds.size} customers missing recurring records...`);

  let nextRecId = 500;
  const { data: maxRec } = await supabase.from('recurring_services').select('id').order('id', { ascending: false }).limit(1);
  if (maxRec && maxRec[0]?.id) nextRecId = Number(maxRec[0].id) + 1;

  for (const cId of missingCustIds) {
    const norm = custIdToNorm.get(cId) || '';
    let freq = 'MONTHLY';
    for (const [k, f] of clientFreqMap.entries()) {
      if (norm.includes(k) || k.includes(norm)) {
        freq = f;
        break;
      }
    }

    const { data: newRec } = await supabase.from('recurring_services').insert({
      id: nextRecId++,
      customer_id: cId,
      treatment_id: 1,
      frequency: freq,
      status: 'ACTIVE',
      duration_minutes: 60,
      next_service_date: '2026-10-01'
    }).select('id').single();

    if (newRec) {
      recMap.set(`${cId}`, newRec.id);
    }
  }

  // Update existing recurring services frequency to match CSV
  for (const r of existingRecs) {
    const norm = custIdToNorm.get(r.customer_id) || '';
    let targetFreq = null;
    for (const [k, f] of clientFreqMap.entries()) {
      if (norm.includes(k) || k.includes(norm)) {
        targetFreq = f;
        break;
      }
    }
    if (targetFreq && targetFreq !== r.frequency) {
      await supabase.from('recurring_services').update({ frequency: targetFreq }).eq('id', r.id);
    }
  }

  // 3. Update all jobs with their corresponding recurring_service_id in batches
  console.log('Linking jobs to recurring_services...');
  let updatedCount = 0;
  for (const j of jobs) {
    const recId = recMap.get(`${j.customer_id}|${j.treatment_id}`) || recMap.get(`${j.customer_id}`);
    if (recId) {
      const { error } = await supabase.from('jobs').update({ recurring_service_id: recId }).eq('id', j.id);
      if (!error) updatedCount++;
    }
  }

  console.log(`✅ Successfully linked ${updatedCount} / ${jobs.length} jobs to recurring services!`);

  // Verify breakdown
  const { data: verifyJobs } = await supabase.from('jobs').select('id, recurring_services(frequency)');
  const freqCounts = { DAILY: 0, WEEKLY: 0, FORTNIGHTLY: 0, MONTHLY: 0, OTHER: 0 };
  (verifyJobs || []).forEach(j => {
    const f = j.recurring_services?.frequency;
    if (freqCounts[f] !== undefined) freqCounts[f]++;
    else freqCounts.OTHER++;
  });

  console.log('📊 Live Frequency Breakdown across all jobs:');
  console.log(freqCounts);
}

run().catch(err => {
  console.error('Error linking frequencies:', err);
  process.exit(1);
});
