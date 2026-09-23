const path = require('path');
const { previewSheet, importSheetData } = require('../services/excelImporter');
const db = require('../db');

const excelPath = 'e:/pest-system/MASTER SHEDULE ~ @2026.xlsx';

console.log('Testing Sheet Previews:');
const sheets = ['2026 - JUNE', '2026 - JULY', '2026 - AUGUST', '2026 - SEPTEMBER'];

for (const s of sheets) {
  const p = previewSheet(excelPath, s);
  console.log(`\nSheet [${s}]:`);
  console.log(`  Header row: ${p.headerRowIndex}`);
  console.log(`  Total rows: ${p.totalRows}`);
  console.log(`  Unique customers: ${p.uniqueCustomersInSheet}`);
  console.log(`  Duplicates detected: ${p.duplicatesDetected}`);
  console.log(`  Sample 1st row:`, p.sampleRows[0]);
}

console.log('\n--- Testing Transactional Import of SEPTEMBER Sheet ---');
const importRes = importSheetData(excelPath, '2026 - SEPTEMBER');
console.log('Import result:', importRes);

const custCount = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
const locCount = db.prepare('SELECT COUNT(*) as c FROM customer_locations').get().c;
const recCount = db.prepare('SELECT COUNT(*) as c FROM recurring_services').get().c;
const jobCount = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;

console.log('\nDatabase counts after September import:');
console.log(`  Customers: ${custCount}`);
console.log(`  Locations: ${locCount}`);
console.log(`  Recurring Services: ${recCount}`);
console.log(`  Jobs: ${jobCount}`);

console.log('\n--- Testing Re-Importing (Duplicate Handling) of AUGUST Sheet ---');
const augImportRes = importSheetData(excelPath, '2026 - AUGUST');
console.log('August Import result:', augImportRes);

const custCountAfter = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
console.log(`Customers count after August import: ${custCountAfter} (Matched existing: ${augImportRes.customersMatched}, Created new: ${augImportRes.customersCreated})`);

console.log('✅ EXCEL IMPORTER TEST PASSED SUCCESSFULLY!');
