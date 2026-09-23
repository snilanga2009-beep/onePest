const xlsx = require('xlsx');
const path = require('path');
const db = require('../db');
const { calculateNextServiceDate, generateJobCode, formatDateColombo } = require('./recurringEngine');

/**
 * Convert Excel serial date or text date into YYYY-MM-DD
 */
function parseExcelDate(val, defaultYear = 2026, defaultMonth = 6) {
  if (val === undefined || val === null || val === '') return null;

  // If number (Excel serial date)
  if (typeof val === 'number') {
    // Excel serial dates: 1 = 1900-01-01. Over 40000 is 2010+
    if (val > 30000 && val < 60000) {
      const utcDays = Math.floor(val - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      return formatDateColombo(date);
    }
    // If just day of month (e.g. 5, 16)
    if (val >= 1 && val <= 31) {
      const m = String(defaultMonth).padStart(2, '0');
      const d = String(Math.floor(val)).padStart(2, '0');
      return `${defaultYear}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  // Check if string is a number
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (num >= 1 && num <= 31) {
      const m = String(defaultMonth).padStart(2, '0');
      const d = String(num).padStart(2, '0');
      return `${defaultYear}-${m}-${d}`;
    }
  }

  // Format like "13 (2.00 PM)" or "14 (9.00 AM)"
  const dayMatch = str.match(/^(\d{1,2})\s*(\(.*\))?/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const m = String(defaultMonth).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      return `${defaultYear}-${m}-${d}`;
    }
  }

  // ISO string
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  return null;
}

/**
 * Extract time from string like "13 (2.00 PM)" or "week day 10 am"
 */
function extractTime(str) {
  if (!str) return '09:00';
  const match = String(str).match(/(\d{1,2})(?:[\.:](\d{2}))?\s*(am|pm)/i);
  if (match) {
    let hour = parseInt(match[1], 10);
    const min = match[2] ? match[2] : '00';
    const ampm = match[3].toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
  }
  return '09:00';
}

/**
 * Parse contact string e.g. "0770899800 (SHIVANTHI)" or "0763591144 (Office)"
 */
function parseContact(str) {
  if (!str) return { phone: '', contactPerson: '' };
  const s = String(str).trim();
  const match = s.match(/^([0-9\s\+\-\/]+)(?:\((.*)\))?$/);
  if (match) {
    return {
      phone: (match[1] || '').trim(),
      contactPerson: (match[2] || '').trim()
    };
  }
  return { phone: s, contactPerson: '' };
}

/**
 * Normalize customer name for duplicate detection
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .replace(/\b(PVT|LTD|LIMITED|PRIVATE)\b/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect month number and year from sheet name e.g. "2026 - JULY"
 */
function parseSheetMonthYear(sheetName) {
  let year = 2026;
  let month = 6; // default June
  const s = sheetName.toUpperCase();
  if (s.includes('2026')) year = 2026;
  if (s.includes('JUNE')) month = 6;
  else if (s.includes('JULY')) month = 7;
  else if (s.includes('AUGUST')) month = 8;
  else if (s.includes('SEPTEMBER')) month = 9;
  else if (s.includes('OCTOBER')) month = 10;
  else if (s.includes('NOVEMBER')) month = 11;
  else if (s.includes('DECEMBER')) month = 12;
  else if (s.includes('JANUARY')) month = 1;
  else if (s.includes('FEBRUARY')) month = 2;
  else if (s.includes('MARCH')) month = 3;
  else if (s.includes('APRIL')) month = 4;
  else if (s.includes('MAY')) month = 5;
  return { year, month };
}

/**
 * Inspect sheet, detect column mapping and return a preview with sample rows and duplicates
 */
function previewSheet(filePath, sheetName) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found in workbook`);
  }

  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const { year, month } = parseSheetMonthYear(sheetName);

  // Find header row
  let headerRowIdx = 0;
  let colMap = {
    client: -1,
    location: -1,
    contact: -1,
    treatment: -1,
    frequency: -1,
    preferDay: -1,
    duration: -1,
    salesman: -1,
    technician: -1,
    status: -1,
    prevDate: -1,
    nextDate: -1,
    notes: -1
  };

  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r].map(c => String(c).trim().toUpperCase());
    const clientIdx = row.findIndex(c => c.includes('CLIENT') || c.includes('CUSTOMER'));
    if (clientIdx !== -1) {
      headerRowIdx = r;
      row.forEach((colName, idx) => {
        if (colName.includes('CLIENT') || colName.includes('CUSTOMER')) colMap.client = idx;
        else if (colName.includes('TREATMENT')) colMap.treatment = idx;
        else if (colName.includes('LOCATION')) colMap.location = idx;
        else if (colName.includes('CONTACT')) colMap.contact = idx;
        else if (colName.includes('FREQUENCY')) colMap.frequency = idx;
        else if (colName.includes('PREFER') || (colName.includes('DAY') && !colName.includes('PREVIOUS'))) colMap.preferDay = idx;
        else if (colName.includes('DURATION') || colName.includes('PCT')) colMap.duration = idx;
        else if (colName.includes('SALESMAN')) colMap.salesman = idx;
        else if (colName.includes('TECHNICIAN') || colName.includes('KTN')) colMap.technician = idx;
        else if (colName.includes('STATUS') || colName.includes('ARRANGED')) colMap.status = idx;
        else if (colName.includes('PREVIOUS') || colName.includes('LAST')) colMap.prevDate = idx;
        else if (colName.includes('NEXT') || colName.includes('CURRENT')) colMap.nextDate = idx;
        else if (colName.includes('NOTE') || colName.includes('SPECIAL') || colName.includes('SCOPES')) colMap.notes = idx;
      });
      break;
    }
  }

  // Existing customers in DB for duplicate preview
  const existingCustomers = db.prepare('SELECT id, customer_code, name, phone FROM customers').all();
  const existingNormMap = new Map();
  for (const c of existingCustomers) {
    existingNormMap.set(normalizeName(c.name), c);
  }

  const sampleRows = [];
  let totalDataRows = 0;
  let duplicatesDetected = 0;
  const sheetCustomerNames = new Set();

  let currentSection = '';
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    const rowText = row.filter(c => c !== '').join(' ');

    if (/DAILY|WEEKLY|FORTNIGHT|MONTH|3.?MONTH/i.test(rowText) && row.filter(c => c !== '').length <= 4) {
      currentSection = row.filter(c => c !== '').join(' - ');
      continue;
    }

    const clientName = colMap.client !== -1 ? String(row[colMap.client] || '').trim() : '';
    const locationVal = colMap.location !== -1 ? String(row[colMap.location] || '').trim() : '';
    const treatmentVal = colMap.treatment !== -1 ? String(row[colMap.treatment] || '').trim() : '';
    let frequencyVal = colMap.frequency !== -1 ? String(row[colMap.frequency] || '').trim() : '';

    if (!clientName || clientName === 'CLIENT' || clientName === 'MANULAS PEST OPARATIONS' || (/^\d+$/.test(clientName) && clientName.length <= 3)) {
      continue;
    }

    // Skip section headings captured in client column
    if (/^(0\d\s*[\.\-]?\s*)?(MANULAS|PRO PEST|DAILY|WEEKLY|FORTNIGHT|MONTH|3.?MONTH)/i.test(clientName) && !locationVal && !treatmentVal) {
      currentSection = clientName;
      continue;
    }

    if (!frequencyVal && currentSection) {
      if (/DAILY/i.test(currentSection)) frequencyVal = 'Daily';
      else if (/WEEKLY/i.test(currentSection)) frequencyVal = 'Weekly';
      else if (/FORTNIGHT/i.test(currentSection)) frequencyVal = 'Fortnightly';
      else if (/3.?MONTH/i.test(currentSection)) frequencyVal = '3 Monthly';
      else if (/MONTH/i.test(currentSection)) frequencyVal = 'Monthly';
    }
    if (!frequencyVal) frequencyVal = 'Monthly';

    totalDataRows++;
    const norm = normalizeName(clientName);
    const isExistingInDb = existingNormMap.has(norm);
    const isDuplicateInSheet = sheetCustomerNames.has(norm);
    sheetCustomerNames.add(norm);

    if (isExistingInDb || isDuplicateInSheet) {
      duplicatesDetected++;
    }

    if (sampleRows.length < 15) {
      sampleRows.push({
        rowIndex: r + 1,
        client: clientName,
        location: locationVal,
        contact: colMap.contact !== -1 ? String(row[colMap.contact] || '').trim() : '',
        treatment: treatmentVal,
        frequency: frequencyVal,
        preferDay: colMap.preferDay !== -1 ? String(row[colMap.preferDay] || '').trim() : '',
        duration: colMap.duration !== -1 ? String(row[colMap.duration] || '').trim() : '',
        salesman: colMap.salesman !== -1 ? String(row[colMap.salesman] || '').trim() : '',
        prevDate: colMap.prevDate !== -1 ? String(row[colMap.prevDate] || '').trim() : '',
        nextDate: colMap.nextDate !== -1 ? String(row[colMap.nextDate] || '').trim() : '',
        status: colMap.status !== -1 ? String(row[colMap.status] || '').trim() : '',
        isDuplicate: isExistingInDb || isDuplicateInSheet,
        existingCustomer: isExistingInDb ? existingNormMap.get(norm).name : null
      });
    }
  }

  return {
    sheetName,
    detectedYear: year,
    detectedMonth: month,
    headerRowIndex: headerRowIdx,
    rawHeaders: data[headerRowIdx] || [],
    detectedColumnMapping: colMap,
    totalRows: totalDataRows,
    uniqueCustomersInSheet: sheetCustomerNames.size,
    duplicatesDetected,
    sampleRows
  };
}

/**
 * Execute transactional import for a sheet
 */
function importSheetData(filePath, sheetName, customColMap = null) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);

  const preview = previewSheet(filePath, sheetName);
  const colMap = customColMap || preview.detectedColumnMapping;
  const { year, month } = parseSheetMonthYear(sheetName);
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Pre-load treatments, staff, customers
  const treatments = db.prepare('SELECT id, code FROM treatments').all();
  const treatmentMap = new Map();
  for (const t of treatments) treatmentMap.set(t.code.toUpperCase(), t.id);

  const staffList = db.prepare('SELECT id, full_name, username, role FROM staff').all();
  const staffMap = new Map();
  for (const s of staffList) {
    staffMap.set(s.full_name.toUpperCase(), s);
    staffMap.set(s.username.toUpperCase(), s);
  }

  // Prepared statements
  const getCustomerByNorm = db.prepare(`SELECT id, customer_code, name FROM customers WHERE UPPER(name) = ? OR customer_code = ?`);
  const insertCustomer = db.prepare(`
    INSERT INTO customers (customer_code, name, contact_person, phone, location, special_instructions)
    VALUES (@code, @name, @contact_person, @phone, @location, @special_instructions)
  `);
  const getLocation = db.prepare(`SELECT id FROM customer_locations WHERE customer_id = ? AND UPPER(location_name) = ?`);
  const insertLocation = db.prepare(`
    INSERT INTO customer_locations (customer_id, location_name, address, is_primary)
    VALUES (@customer_id, @location_name, @address, @is_primary)
  `);
  const insertRecurring = db.prepare(`
    INSERT INTO recurring_services (
      customer_id, location_id, treatment_id, frequency, preferred_day,
      preferred_time, duration_minutes, technician_id, salesman_id,
      last_service_date, next_service_date, notes
    ) VALUES (
      @customer_id, @location_id, @treatment_id, @frequency, @preferred_day,
      @preferred_time, @duration_minutes, @technician_id, @salesman_id,
      @last_service_date, @next_service_date, @notes
    )
  `);
  const getExistingJob = db.prepare(`SELECT id FROM jobs WHERE (customer_id = ? AND scheduled_date = ? AND treatment_id = ?) OR (recurring_service_id = ? AND scheduled_date = ?)`);
  const insertJob = db.prepare(`
    INSERT INTO jobs (
      job_code, recurring_service_id, customer_id, location_id, treatment_id,
      technician_id, salesman_id, scheduled_date, scheduled_time, duration_minutes,
      status, technician_notes
    ) VALUES (
      @job_code, @recurring_service_id, @customer_id, @location_id, @treatment_id,
      @technician_id, @salesman_id, @scheduled_date, @scheduled_time, @duration_minutes,
      @status, @technician_notes
    )
  `);

  // In-memory customer cache for instant lookup within transaction
  const customerCache = new Map();
  const allExisting = db.prepare('SELECT id, customer_code, name FROM customers').all();
  for (const c of allExisting) {
    customerCache.set(c.name.toUpperCase().trim(), c);
  }

  let custSequence = (db.prepare('SELECT MAX(id) as m FROM customers').get().m || 0);
  let jobSequence = (db.prepare('SELECT COUNT(*) as c FROM jobs').get().c || 0);

  let customersCreated = 0;
  let customersMatched = 0;
  let locationsCreated = 0;
  let recurringCreated = 0;
  let jobsCreated = 0;

  let currentSection = '';

  const tx = db.transaction(() => {
    for (let r = preview.headerRowIndex + 1; r < data.length; r++) {
      const row = data[r];
      const rowText = row.filter(c => c !== '').join(' ');

      // Detect section changes
      if (/DAILY|WEEKLY|FORTNIGHT|MONTH|3.?MONTH/i.test(rowText) && row.filter(c => c !== '').length <= 4) {
        currentSection = row.filter(c => c !== '').join(' - ');
        continue;
      }

      const clientRaw = colMap.client !== -1 ? String(row[colMap.client] || '').trim() : '';
      if (!clientRaw || clientRaw === 'CLIENT' || clientRaw === 'MANULAS PEST OPARATIONS' || (/^\d+$/.test(clientRaw) && clientRaw.length <= 3)) {
        continue;
      }

      const locationRaw = colMap.location !== -1 ? String(row[colMap.location] || '').trim() : '';
      const contactRaw = colMap.contact !== -1 ? String(row[colMap.contact] || '').trim() : '';
      let treatmentRaw = colMap.treatment !== -1 ? String(row[colMap.treatment] || '').trim() : '';

      // Skip section headings captured in client column
      if (/^(0\d\s*[\.\-]?\s*)?(MANULAS|PRO PEST|DAILY|WEEKLY|FORTNIGHT|MONTH|3.?MONTH)/i.test(clientRaw) && !locationRaw && !treatmentRaw) {
        currentSection = clientRaw;
        continue;
      }

      let frequencyRaw = colMap.frequency !== -1 ? String(row[colMap.frequency] || '').trim() : '';
      const preferDayRaw = colMap.preferDay !== -1 ? String(row[colMap.preferDay] || '').trim() : '';
      const durationRaw = colMap.duration !== -1 ? String(row[colMap.duration] || '').trim() : '';
      const salesmanRaw = colMap.salesman !== -1 ? String(row[colMap.salesman] || '').trim() : '';
      const technicianRaw = colMap.technician !== -1 ? String(row[colMap.technician] || '').trim() : '';
      const statusRaw = colMap.status !== -1 ? String(row[colMap.status] || '').trim() : '';
      const prevDateRaw = colMap.prevDate !== -1 ? row[colMap.prevDate] : '';
      const nextDateRaw = colMap.nextDate !== -1 ? row[colMap.nextDate] : '';

      // Infer frequency from section if missing
      if (!frequencyRaw && currentSection) {
        if (/DAILY/i.test(currentSection)) frequencyRaw = 'Daily';
        else if (/WEEKLY/i.test(currentSection)) frequencyRaw = 'Weekly';
        else if (/FORTNIGHT/i.test(currentSection)) frequencyRaw = 'Fortnightly';
        else if (/3.?MONTH/i.test(currentSection)) frequencyRaw = '3 Monthly';
        else if (/MONTH/i.test(currentSection)) frequencyRaw = 'Monthly';
      }
      if (!frequencyRaw) frequencyRaw = 'Monthly';

      // Standardize frequency
      let normFreq = 'MONTHLY';
      if (/DAILY/i.test(frequencyRaw)) normFreq = 'DAILY';
      else if (/FORTNIGHT/i.test(frequencyRaw)) normFreq = 'FORTNIGHTLY';
      else if (/WEEKLY/i.test(frequencyRaw)) normFreq = 'WEEKLY';
      else if (/3.?MONTH/i.test(frequencyRaw)) normFreq = '3 MONTHLY';

      // Parse contact
      const { phone, contactPerson } = parseContact(contactRaw);

      // 1. Find or create Customer
      const clientKey = clientRaw.toUpperCase().trim();
      let customer = customerCache.get(clientKey) || getCustomerByNorm.get(clientKey, clientRaw);
      let customerId;

      if (!customer) {
        custSequence++;
        const custCode = `CUST-${String(custSequence).padStart(4, '0')}`;
        const res = insertCustomer.run({
          code: custCode,
          name: clientRaw,
          contact_person: contactPerson,
          phone: phone,
          location: locationRaw,
          special_instructions: durationRaw ? `Duration/PCT: ${durationRaw}` : ''
        });
        customerId = res.lastInsertRowid;
        customer = { id: customerId, customer_code: custCode, name: clientRaw };
        customerCache.set(clientKey, customer);
        customersCreated++;
      } else {
        customerId = customer.id;
        customersMatched++;
      }

      // 2. Find or create Location if location is given
      let locationId = null;
      if (locationRaw) {
        const existingLoc = getLocation.get(customerId, locationRaw.toUpperCase());
        if (existingLoc) {
          locationId = existingLoc.id;
        } else {
          const locRes = insertLocation.run({
            customer_id: customerId,
            location_name: locationRaw,
            address: locationRaw,
            is_primary: 1
          });
          locationId = locRes.lastInsertRowid;
          locationsCreated++;
        }
      }

      // 3. Resolve Treatment
      let treatmentCode = treatmentRaw.replace(/\s+/g, '').replace(/\+/g, '/').toUpperCase();
      if (!treatmentCode) treatmentCode = 'GPC';
      let treatmentId = treatmentMap.get(treatmentCode);
      if (!treatmentId) {
        // Create custom treatment code if new
        const newTreatmentRes = db.prepare(`
          INSERT INTO treatments (code, name, description, default_duration_minutes)
          VALUES (?, ?, ?, ?)
        `).run(treatmentCode, `Treatment ${treatmentCode}`, 'Imported from schedule', 60);
        treatmentId = newTreatmentRes.lastInsertRowid;
        treatmentMap.set(treatmentCode, treatmentId);
      }

      // 4. Resolve Staff (Technician & Salesman)
      let salesmanId = null;
      if (salesmanRaw) {
        const found = staffMap.get(salesmanRaw.toUpperCase());
        if (found) salesmanId = found.id;
      }
      let technicianId = null;
      if (technicianRaw) {
        const found = staffMap.get(technicianRaw.toUpperCase());
        if (found) technicianId = found.id;
      }

      // Parse duration
      let durationMinutes = 60;
      const durationMatch = durationRaw.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)/i);
      if (durationMatch) {
        durationMinutes = Math.round(parseFloat(durationMatch[1]) * 60);
      }

      // Parse preferred time
      const preferredTime = extractTime(durationRaw || nextDateRaw || '09:00');

      // Parse Dates
      const parsedPrevDate = parseExcelDate(prevDateRaw, year, month);
      let parsedNextDate = parseExcelDate(nextDateRaw, year, month);

      if (!parsedNextDate) {
        // Calculate based on sheet month
        parsedNextDate = `${year}-${String(month).padStart(2, '0')}-15`;
      }

      // 5. Create or get recurring service
      const existingRec = db.prepare(`
        SELECT id FROM recurring_services
        WHERE customer_id = ? AND treatment_id = ? AND (location_id = ? OR (location_id IS NULL AND ? IS NULL))
      `).get(customerId, treatmentId, locationId, locationId);

      let recurringServiceId;
      if (!existingRec) {
        const recRes = insertRecurring.run({
          customer_id: customerId,
          location_id: locationId,
          treatment_id: treatmentId,
          frequency: normFreq,
          preferred_day: preferDayRaw ? preferDayRaw.toUpperCase().substring(0, 3) : null,
          preferred_time: preferredTime,
          duration_minutes: durationMinutes,
          technician_id: technicianId,
          salesman_id: salesmanId,
          last_service_date: parsedPrevDate,
          next_service_date: parsedNextDate,
          notes: durationRaw ? `PCT Note: ${durationRaw}` : null
        });
        recurringServiceId = recRes.lastInsertRowid;
        recurringCreated++;
      } else {
        recurringServiceId = existingRec.id;
      }

      // 6. Generate Jobs for dates listed in sheet
      // Check if multiple dates exist (e.g. "6,13,20,27")
      const rawDateStr = String(nextDateRaw || '').trim();
      const multipleDatesMatch = rawDateStr.split(/[,\s]+/).filter(p => /^\d{1,2}$/.test(p));

      const datesToSchedule = [];
      if (multipleDatesMatch.length > 1) {
        for (const d of multipleDatesMatch) {
          const dateStr = parseExcelDate(parseInt(d, 10), year, month);
          if (dateStr) datesToSchedule.push(dateStr);
        }
      } else if (parsedNextDate) {
        datesToSchedule.push(parsedNextDate);
      }

      // If prevDate exists and was DONE, record historical completed job!
      if (parsedPrevDate) {
        const existingHist = getExistingJob.get(customerId, parsedPrevDate, treatmentId, recurringServiceId, parsedPrevDate);
        if (!existingHist) {
          jobSequence++;
          const cleanPrev = (parsedPrevDate || '').replace(/-/g, '');
          const histJobCode = `JOB-${cleanPrev}-${String(jobSequence).padStart(4, '0')}`;
          insertJob.run({
            job_code: histJobCode,
            recurring_service_id: recurringServiceId,
            customer_id: customerId,
            location_id: locationId,
            treatment_id: treatmentId,
            technician_id: technicianId,
            salesman_id: salesmanId,
            scheduled_date: parsedPrevDate,
            scheduled_time: preferredTime,
            duration_minutes: durationMinutes,
            status: 'COMPLETED',
            technician_notes: 'Historical completed service from master schedule'
          });
          jobsCreated++;
        }
      }

      // For upcoming dates
      for (const scheduledDate of datesToSchedule) {
        const existingJob = getExistingJob.get(customerId, scheduledDate, treatmentId, recurringServiceId, scheduledDate);
        if (!existingJob) {
          jobSequence++;
          const isDone = /DONE/i.test(statusRaw);
          const jobStatus = isDone ? 'COMPLETED' : (/ARRANGED/i.test(statusRaw) ? 'CONFIRMED' : 'TO_BE_DONE');
          const cleanSched = (scheduledDate || '').replace(/-/g, '');
          const jobCode = `JOB-${cleanSched}-${String(jobSequence).padStart(4, '0')}`;

          insertJob.run({
            job_code: jobCode,
            recurring_service_id: recurringServiceId,
            customer_id: customerId,
            location_id: locationId,
            treatment_id: treatmentId,
            technician_id: technicianId,
            salesman_id: salesmanId,
            scheduled_date: scheduledDate,
            scheduled_time: preferredTime,
            duration_minutes: durationMinutes,
            status: jobStatus,
            technician_notes: durationRaw ? `Details: ${durationRaw}` : ''
          });
          jobsCreated++;
        }
      }
    }
  });

  tx();

  return {
    success: true,
    sheetName,
    customersCreated,
    customersMatched,
    locationsCreated,
    recurringCreated,
    jobsCreated
  };
}

module.exports = {
  previewSheet,
  importSheetData,
  parseExcelDate,
  parseContact,
  normalizeName
};
