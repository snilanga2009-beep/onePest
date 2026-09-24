const app = require('../api/index');
const http = require('http');

let server;
const PORT = 3921;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTests() {
  console.log('--- Starting OnePest SMS, Auto-Schedule & System Verification ---');

  // Start server
  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`Test Express server running on ${BASE_URL}`);
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      console.log(`\n[RUNNING] ${name}`);
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Helper fetch
  async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: res.status, ok: res.ok, data: json };
  }

  // 1. Test Health
  await test('GET /api/health', async () => {
    const res = await api('/api/health');
    if (!res.ok || res.data.status !== 'ok') throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
  });

  // 2. Test Phone Validation
  await test('POST /api/sms/validate-phone', async () => {
    const res = await api('/api/sms/validate-phone', {
      method: 'POST',
      body: JSON.stringify({ phone: '0771234567' })
    });
    if (!res.ok || !res.data.isValid || res.data.normalized !== '94771234567' || res.data.operator !== 'Dialog Axiata') {
      throw new Error(`Invalid validation response: ${JSON.stringify(res.data)}`);
    }
  });

  // 3. Test SMS Send-Test (The exact user error!)
  await test('POST /api/sms/send-test', async () => {
    const res = await api('/api/sms/send-test', {
      method: 'POST',
      body: JSON.stringify({
        to: '0771234567',
        message: 'OnePest: Automated Verification Test SMS'
      })
    });
    if (res.status === 404) {
      throw new Error('Endpoint not found: POST /api/sms/send-test still failing with 404!');
    }
    if (!res.data.success) {
      throw new Error(`SMS send test did not succeed: ${JSON.stringify(res.data)}`);
    }
    console.log(`   SMS Result: Provider=${res.data.provider}, Phone=${res.data.phone}, Simulated=${res.data.simulated}`);
  });

  // 4. Test SMS Settings
  await test('GET /api/sms/settings', async () => {
    const res = await api('/api/sms/settings');
    if (!res.ok || !res.data.success || !res.data.providers || !res.data.stats) {
      throw new Error(`Invalid settings response: ${JSON.stringify(res.data)}`);
    }
    console.log(`   SMS Providers available: ${res.data.providers.length}, Provider in use: ${res.data.settings?.provider}`);
  });

  // 5. Test SMS Logs
  await test('GET /api/sms/logs', async () => {
    const res = await api('/api/sms/logs?limit=5');
    if (!res.ok || !res.data.success || !Array.isArray(res.data.logs)) {
      throw new Error(`Invalid logs response: ${JSON.stringify(res.data)}`);
    }
    console.log(`   SMS Logs count: ${res.data.logs.length}`);
  });

  // 6. Test Auto-Scheduling Engine
  await test('POST /api/automation/generate-jobs', async () => {
    const res = await api('/api/automation/generate-jobs', {
      method: 'POST',
      body: JSON.stringify({ horizon_days: 14 })
    });
    if (!res.ok || !res.data.success) {
      throw new Error(`Job generation failed: ${JSON.stringify(res.data)}`);
    }
    console.log(`   Auto-Schedule Result: ${res.data.message}`);
  });

  // 7. Test Daily Automation Check
  await test('POST /api/automation/run-daily', async () => {
    const res = await api('/api/automation/run-daily', {
      method: 'POST'
    });
    if (!res.ok || !res.data.success || !res.data.result) {
      throw new Error(`Daily automation failed: ${JSON.stringify(res.data)}`);
    }
    console.log(`   Daily Automation Result: ${res.data.message}`);
  });

  // 8. Test Reminders Queue
  await test('GET /api/reminders/queue', async () => {
    const res = await api('/api/reminders/queue');
    if (!res.ok || !res.data.success || !res.data.counts) {
      throw new Error(`Reminders queue failed: ${JSON.stringify(res.data)}`);
    }
    console.log(`   Today reminders: ${res.data.counts.today_reminders}, Tomorrow: ${res.data.counts.tomorrow_reminders}, Tech routes: ${res.data.technicians_routes?.length}`);
  });

  // 9. Test Customer Confirmation
  await test('GET /api/confirmations/:jobCode', async () => {
    // Pick an existing job code from Supabase
    const { supabase } = require('../api/lib/supabase');
    const { data: sampleJob } = await supabase.from('jobs').select('job_code').limit(1).single();
    if (!sampleJob) {
      console.log('   Skipping confirmation test (no jobs in DB)');
      return;
    }
    const res = await api(`/api/confirmations/${sampleJob.job_code}`);
    if (!res.ok || !res.data.success || !res.data.appointment) {
      throw new Error(`Confirmation portal lookup failed: ${JSON.stringify(res.data)}`);
    }
    console.log(`   Confirmation Portal returned job #${res.data.appointment.job_code} for ${res.data.appointment.customer_name}`);
  });

  // 10. Test Database Backup
  await test('GET /api/backup', async () => {
    const res = await api('/api/backup');
    if (!res.ok || !res.data.success || !res.data.stats) {
      throw new Error(`Backup endpoint failed: ${JSON.stringify(res.data)}`);
    }
    console.log(`   Backups found: ${res.data.backups.length}, Size: ${res.data.stats.total_size_mb}`);
  });

  // Cleanup
  server.close();
  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  if (server) server.close();
  process.exit(1);
});
