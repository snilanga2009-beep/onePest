/**
 * Vercel Serverless Function & Cron Job: /api/cron/check-overdue
 * Identifies overdue pest control jobs and triggers push notifications to technicians
 */

module.exports = async function handler(req, res) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(200).json({
        success: true,
        message: 'Supabase credentials not configured in environment; skipped overdue check.'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Current date in Asia/Colombo (GMT+5:30)
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    // Fetch overdue jobs: scheduled_date < today AND status not COMPLETED/CANCELLED
    const { data: overdueJobs, error } = await supabase
      .from('jobs')
      .select('*, customers(name), staff!jobs_technician_id_fkey(full_name)')
      .in('status', ['TO_BE_DONE', 'ASSIGNED', 'IN_PROGRESS'])
      .lt('scheduled_date', today)
      .not('technician_id', 'is', null);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    let notifiedCount = 0;

    // Trigger push notification for each overdue job
    for (const job of overdueJobs || []) {
      const customerName = job.customers?.name || 'Customer';
      try {
        const pushRes = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            technician_id: job.technician_id,
            type: 'JOB_OVERDUE',
            title: '⚠️ Overdue Job Alert',
            body: `${customerName} was scheduled for ${job.scheduled_date}. Please update status or reschedule.`,
            jobId: job.id,
            url: `/tech?job=${job.id}`,
            tag: `job-overdue-${job.id}`
          })
        });
        if (pushRes.ok) notifiedCount++;
      } catch (err) {
        console.warn(`[Overdue Cron] Failed push for job ${job.id}:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      overdueCount: overdueJobs ? overdueJobs.length : 0,
      notifiedCount
    });
  } catch (error) {
    console.error('[Overdue Cron Handler] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
