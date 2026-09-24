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

for (let i = 603; i < lines.length; i++) {
  const line = lines[i];
  if (!line || line.startsWith(',,,,') || line.includes('MANULAS PEST')) continue;
  const cols = parseCSVLine(line);
  if (cols.length < 5) continue;
  const client = cols[1];
  const prev = cols[3];
  const next = cols[4];
  const treatment = cols[6];
  const location = cols[7];
  if (!client || client === 'CLIENT') continue;
  console.log(`Row ${i}: Client="${client}" | Prev="${prev}" | Next="${next}" | Treatment="${treatment}" | Loc="${location}"`);
}
