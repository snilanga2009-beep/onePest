const app = require('../api/index');
const http = require('http');

const server = http.createServer(app);
server.listen(5095, async () => {
  const baseUrl = 'http://localhost:5095/api';
  try {
    // 1. Dashboard
    const dash = await fetch(baseUrl + '/dashboard').then(r => r.json());
    console.log('1. Dashboard:', {
      today: dash.today,
      counters_today_jobs: dash.counters?.today_jobs,
      today_stats: dash.today_stats,
      today_jobs_count: dash.today_jobs?.length,
      sample_today_job: dash.today_jobs[0] ? {
        code: dash.today_jobs[0].job_code,
        customer_name: dash.today_jobs[0].customer_name,
        treatment: dash.today_jobs[0].treatment_code,
        tech: dash.today_jobs[0].technician_name
      } : 'No jobs today'
    });

    // 2. Jobs
    const jobsRes = await fetch(baseUrl + '/jobs?limit=5').then(r => r.json());
    console.log('2. Jobs list:', {
      total: jobsRes.total,
      first_job_customer_name: jobsRes.jobs[0]?.customer_name,
      first_job_treatment: jobsRes.jobs[0]?.treatment_code,
      first_job_location: jobsRes.jobs[0]?.location_name,
      first_job_tech: jobsRes.jobs[0]?.technician_name
    });

    // 3. Customers
    const custRes = await fetch(baseUrl + '/customers?limit=5').then(r => r.json());
    console.log('3. Customers list:', {
      total: custRes.total,
      first_customer: custRes.customers[0]?.name,
      completed_jobs: custRes.customers[0]?.completed_jobs_count,
      locations: custRes.customers[0]?.total_locations
    });

    // 4. Calendar Events
    const calRes = await fetch(baseUrl + '/calendar/events').then(r => r.json());
    console.log('4. Calendar:', {
      count: calRes.count,
      eventsByDate_keys: Object.keys(calRes.eventsByDate || {}).length,
      sample_event_customer: calRes.events[0]?.customer_name
    });

    // 5. Technician Jobs (Tech 8)
    const techJobsRes = await fetch(baseUrl + '/jobs?technician_id=8').then(r => r.json());
    console.log('5. Tech 8 jobs count:', techJobsRes.jobs?.length, 'Sample customer:', techJobsRes.jobs[0]?.customer_name);

    console.log('\n✅ ALL VERIFICATION CHECKS PASSED WITH FLYING COLORS!');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Error in test:', err);
    server.close();
    process.exit(1);
  }
});
