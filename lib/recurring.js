const { supabase } = require('./supabase');

const DAY_MAP = {
  SUN: 0, SUNDAY: 0,
  MON: 1, MONDAY: 1,
  TUE: 2, TUESDAY: 2,
  WED: 3, WEDNESDAY: 3,
  THU: 4, THURSDAY: 4,
  FRI: 5, FRIDAY: 5,
  SAT: 6, SATURDAY: 6
};

function formatDateColombo(date) {
  const d = new Date(date);
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const colomboTime = new Date(utc + (330 * 60000));
  const year = colomboTime.getFullYear();
  const month = String(colomboTime.getMonth() + 1).padStart(2, '0');
  const day = String(colomboTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateColombo(dateStr) {
  if (!dateStr) return new Date();
  const parts = String(dateStr).trim().split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 6, 0, 0));
  }
  return new Date(dateStr);
}

function alignToDayOfWeek(dateObj, preferredDay) {
  const norm = String(preferredDay).trim().toUpperCase();
  if (DAY_MAP[norm] !== undefined) {
    const targetDay = DAY_MAP[norm];
    const currentDay = dateObj.getUTCDay();
    const diff = (targetDay - currentDay + 7) % 7;
    if (diff !== 0) {
      dateObj.setUTCDate(dateObj.getUTCDate() + diff);
    }
  }
}

function alignToNearestDayOfWeek(dateObj, preferredDay) {
  const norm = String(preferredDay).trim().toUpperCase();
  if (DAY_MAP[norm] !== undefined) {
    const targetDay = DAY_MAP[norm];
    const currentDay = dateObj.getUTCDay();
    let diff = targetDay - currentDay;
    if (diff > 3) diff -= 7;
    if (diff < -3) diff += 7;
    dateObj.setUTCDate(dateObj.getUTCDate() + diff);
  }
}

function calculateNextServiceDate(baseDate, frequency, preferredDay = null, customDays = 30) {
  const base = parseDateColombo(baseDate);
  const freq = (frequency || 'MONTHLY').toUpperCase().trim();
  const target = new Date(base.getTime());

  if (freq === 'DAILY') {
    target.setUTCDate(target.getUTCDate() + 1);
  } else if (freq === 'WEEKLY') {
    target.setUTCDate(target.getUTCDate() + 7);
    if (preferredDay) alignToDayOfWeek(target, preferredDay);
  } else if (freq === 'FORTNIGHTLY') {
    target.setUTCDate(target.getUTCDate() + 14);
    if (preferredDay) alignToDayOfWeek(target, preferredDay);
  } else if (freq === 'MONTHLY') {
    const currentDay = target.getUTCDate();
    target.setUTCMonth(target.getUTCMonth() + 1);
    if (target.getUTCDate() !== currentDay) target.setUTCDate(0);
    if (preferredDay) alignToNearestDayOfWeek(target, preferredDay);
  } else if (freq === '3 MONTHLY' || freq === '3MONTHLY' || freq === 'QUARTERLY') {
    const currentDay = target.getUTCDate();
    target.setUTCMonth(target.getUTCMonth() + 3);
    if (target.getUTCDate() !== currentDay) target.setUTCDate(0);
    if (preferredDay) alignToNearestDayOfWeek(target, preferredDay);
  } else if (freq === 'CUSTOM') {
    target.setUTCDate(target.getUTCDate() + (customDays || 30));
  } else {
    target.setUTCMonth(target.getUTCMonth() + 1);
  }

  return formatDateColombo(target);
}

function generateJobCode(dateStr) {
  const cleanDate = (dateStr || formatDateColombo(new Date())).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `JOB-${cleanDate}-${rand}`;
}

/**
 * Scans all active recurring services in Supabase and automatically schedules upcoming jobs
 */
async function generateJobsForDueServices(horizonDays = 14) {
  const today = formatDateColombo(new Date());
  const maxDateObj = parseDateColombo(today);
  maxDateObj.setUTCDate(maxDateObj.getUTCDate() + horizonDays);
  const horizonDate = formatDateColombo(maxDateObj);

  // Fetch all active recurring services due up to horizonDate
  const { data: dueServices, error } = await supabase
    .from('recurring_services')
    .select('*, customers(id, customer_code, name, special_instructions), treatments(id, code, default_duration_minutes)')
    .eq('status', 'ACTIVE')
    .lte('next_service_date', horizonDate);

  if (error || !dueServices) return { success: false, error: error?.message, createdCount: 0, jobs: [] };

  // Fetch existing scheduled jobs in range
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('recurring_service_id, scheduled_date')
    .not('recurring_service_id', 'is', null)
    .gte('scheduled_date', today)
    .lte('scheduled_date', horizonDate);

  const existingMap = new Set((existingJobs || []).map(j => `${j.recurring_service_id}_${j.scheduled_date}`));

  // Get max job id to avoid identity sequence collision
  const { data: maxRow } = await supabase.from('jobs').select('id').order('id', { ascending: false }).limit(1);
  let currentMaxId = maxRow && maxRow[0]?.id ? Number(maxRow[0].id) : 0;

  const newJobsToInsert = [];
  for (const service of dueServices) {
    const key = `${service.id}_${service.next_service_date}`;
    if (!existingMap.has(key)) {
      currentMaxId++;
      const jobCode = generateJobCode(service.next_service_date);
      newJobsToInsert.push({
        id: currentMaxId,
        job_code: jobCode,
        recurring_service_id: service.id,
        customer_id: service.customer_id,
        location_id: service.location_id,
        treatment_id: service.treatment_id,
        technician_id: service.technician_id,
        salesman_id: service.salesman_id,
        scheduled_date: service.next_service_date,
        scheduled_time: service.preferred_time || '09:00',
        duration_minutes: service.duration_minutes || service.treatments?.default_duration_minutes || 60,
        status: 'TO_BE_DONE',
        technician_notes: service.notes || service.customers?.special_instructions || ''
      });
      existingMap.add(key);
    }
  }

  if (newJobsToInsert.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from('jobs')
      .insert(newJobsToInsert)
      .select('*, customers(*), treatments(*), staff!jobs_technician_id_fkey(*)');

    if (insErr) {
      console.error('Job generation insert error:', insErr);
      return { success: false, error: insErr.message, createdCount: 0, jobs: [] };
    }

    return {
      success: true,
      createdCount: inserted?.length || newJobsToInsert.length,
      jobs: inserted || newJobsToInsert,
      message: `Successfully generated ${newJobsToInsert.length} automated jobs up to ${horizonDate}.`
    };
  }

  return {
    success: true,
    createdCount: 0,
    jobs: [],
    message: `All recurring services up to ${horizonDate} are already scheduled. No new jobs needed.`
  };
}

/**
 * Handles completing a job: marks job as completed, updates recurring service contract,
 * and automatically generates the next recurring job in the future!
 */
async function handleJobCompletion(jobId, completionData = {}) {
  const { data: job, error: jErr } = await supabase
    .from('jobs')
    .select('*, recurring_services(*)')
    .eq('id', jobId)
    .single();

  if (jErr || !job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const now = new Date().toISOString();
  const completionDate = job.scheduled_date || formatDateColombo(new Date());

  // 1. Mark job as completed
  const { data: updatedJob, error: uErr } = await supabase
    .from('jobs')
    .update({
      status: 'COMPLETED',
      actual_start_time: completionData.actual_start_time || now,
      actual_end_time: completionData.actual_end_time || now,
      technician_notes: completionData.technician_notes || job.technician_notes,
      customer_signature: completionData.customer_signature || job.customer_signature,
      completed_at: now,
      updated_at: now
    })
    .eq('id', jobId)
    .select('*, customers(*), customer_locations(*), treatments(*), staff!jobs_technician_id_fkey(*)')
    .single();

  if (uErr) throw uErr;

  let nextJob = null;
  let nextDate = null;

  // 2. If part of recurring service, calculate next date & generate next job!
  if (job.recurring_service_id && job.recurring_services) {
    const rec = job.recurring_services;
    nextDate = calculateNextServiceDate(completionDate, rec.frequency, rec.preferred_day);

    // Update contract dates
    await supabase
      .from('recurring_services')
      .update({
        last_service_date: completionDate,
        next_service_date: nextDate,
        updated_at: now
      })
      .eq('id', rec.id);

    // Check if next job already exists
    const { data: existingNext } = await supabase
      .from('jobs')
      .select('id')
      .eq('recurring_service_id', rec.id)
      .eq('scheduled_date', nextDate)
      .maybeSingle();

    if (!existingNext) {
      const { data: maxNextRow } = await supabase.from('jobs').select('id').order('id', { ascending: false }).limit(1);
      const nextId = (maxNextRow && maxNextRow[0]?.id ? Number(maxNextRow[0].id) : 0) + 1;
      const nextJobCode = generateJobCode(nextDate);
      const { data: createdNext } = await supabase
        .from('jobs')
        .insert({
          id: nextId,
          job_code: nextJobCode,
          recurring_service_id: rec.id,
          customer_id: rec.customer_id,
          location_id: rec.location_id,
          treatment_id: rec.treatment_id,
          technician_id: rec.technician_id,
          salesman_id: rec.salesman_id,
          scheduled_date: nextDate,
          scheduled_time: rec.preferred_time || '09:00',
          duration_minutes: rec.duration_minutes || 60,
          status: 'TO_BE_DONE',
          technician_notes: rec.notes || ''
        })
        .select()
        .single();

      nextJob = createdNext;
    }
  }

  return {
    job: updatedJob,
    nextJob,
    nextDate
  };
}

module.exports = {
  formatDateColombo,
  calculateNextServiceDate,
  generateJobCode,
  generateJobsForDueServices,
  handleJobCompletion
};
