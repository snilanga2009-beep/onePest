const fs = require('fs');
const lines = fs.readFileSync('data/fresh_schedule.csv', 'utf8').split(/\r?\n/);
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let c of line) {
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result.map(s => s.trim().replace(/^"|"$/g, ''));
}
const valCounts = {};
for (let i = 3; i < 224; i++) {
  const line = lines[i];
  if (!line) continue;
  const cols = parseCSVLine(line);
  for (let d = 1; d <= 30; d++) {
    const val = cols[9 + d]?.trim();
    if (val) valCounts[val] = (valCounts[val] || 0) + 1;
  }
}
console.log(valCounts);
