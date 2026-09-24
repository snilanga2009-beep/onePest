const fs = require('fs');

const raw = fs.readFileSync('data/fresh_schedule.csv', 'utf8');
const lines = raw.split(/\r?\n/);

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

const allJobs = [];

// --- Section 1: Lines 0 to 223 (Matrix 1) ---
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
  const status = cols[1] || 'ARRANGED';

  for (let day = 1; day <= 30; day++) {
    const colIdx = 9 + day;
    if (colIdx < cols.length) {
      const val = cols[colIdx]?.trim();
      if (!val) continue;
      // Real checkmark or time/action note
      const isCheck = val === '✅' || val === '❎' || val.toLowerCase() === 'x';
      const isTimeOrAction = /\d{1,2}(:\d{2}|pm|am)/i.test(val) || val.toLowerCase() === 'fly' || val.toLowerCase() === 'termite' || val.toLowerCase() === 'full';
      if (isCheck || isTimeOrAction) {
        allJobs.push({
          client,
          treatment,
          location,
          phone,
          day,
          source: 'Matrix1'
        });
      }
    }
  }
}

// --- Section 2: Lines 224 to 412 (Matrix 2 & Monthly/Weekly) ---
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

  // Extract from dateCol
  const daysFromDate = extractDayNumbers(dateCol);
  for (const d of daysFromDate) {
    if (d >= 1 && d <= 30) {
      allJobs.push({ client, treatment, location, phone, day: d, source: 'Matrix2-Date' });
    }
  }

  // Extract from calendar day columns (cols 11 to 41 for days 1 to 31)
  for (let day = 1; day <= 31; day++) {
    const colIdx = 10 + day;
    if (colIdx < cols.length) {
      const val = cols[colIdx]?.trim();
      if (!val) continue;
      const isCheck = val === '✅' || val === '❎' || val.toLowerCase() === 'x';
      const isTimeOrAction = /\d{1,2}(:\d{2}|pm|am)/i.test(val) || val.toLowerCase() === 'fly' || val.toLowerCase() === 'termite' || val.toLowerCase() === 'full';
      if (isCheck || isTimeOrAction) {
        allJobs.push({ client, treatment, location, phone, day, source: 'Matrix2-Col' });
      }
    }
  }
}

// --- Section 3: Lines 413 to 601 (Table with LAST DATE & CURRENT DATE) ---
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

  const days = [...new Set([...extractDayNumbers(currDate), ...extractDayNumbers(lastDate)])];
  for (const d of days) {
    if (d >= 1 && d <= 30) {
      allJobs.push({ client, treatment, location, phone, day: d, source: 'Section3-Dates' });
    }
  }
}

// --- Section 4: Lines 602 to 743 (Master Table MANULAS PEST OPARATIONS) ---
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

  const days = [...new Set([...extractDayNumbers(nextDate), ...extractDayNumbers(prevDate)])];
  for (const d of days) {
    if (d >= 1 && d <= 30) {
      allJobs.push({ client, treatment, location, phone, day: d, source: 'MasterTable' });
    }
  }
}

console.log(`Extracted total raw instances: ${allJobs.length}`);

// Deduplicate jobs by normalized client + day
const uniqueMap = new Map();
for (const j of allJobs) {
  const normClient = j.client.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${normClient}|${j.day}`;
  if (!uniqueMap.has(key)) {
    uniqueMap.set(key, j);
  } else {
    const existing = uniqueMap.get(key);
    if (j.treatment.length > existing.treatment.length && !existing.treatment.includes('/')) {
      existing.treatment = j.treatment;
    }
    if (j.phone && !existing.phone) existing.phone = j.phone;
    if (j.location && j.location !== 'Colombo') existing.location = j.location;
  }
}

const finalJobs = Array.from(uniqueMap.values());
console.log(`Unique Real Jobs: ${finalJobs.length}`);

const dayCounts = {};
for (let d = 1; d <= 30; d++) dayCounts[d] = 0;
for (const j of finalJobs) dayCounts[j.day] = (dayCounts[j.day] || 0) + 1;

console.log('Daily Distribution:');
console.log(dayCounts);

console.log(`\nToday (Day 24): ${dayCounts[24]} jobs:`);
finalJobs.filter(j => j.day === 24).forEach(j => {
  console.log(`  - ${j.client} (${j.treatment}) @ ${j.location}`);
});

console.log(`\nTomorrow (Day 25): ${dayCounts[25]} jobs:`);
finalJobs.filter(j => j.day === 25).forEach(j => {
  console.log(`  - ${j.client} (${j.treatment}) @ ${j.location}`);
});
