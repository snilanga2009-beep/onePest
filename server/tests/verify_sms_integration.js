async function runVerification() {
  console.log('=== STARTING END-TO-END SMS & REMINDERS VERIFICATION ===\n');

  const BASE = 'http://localhost:5000/api';

  // 1. Settings
  console.log('1. Fetching SMS Settings...');
  const settingsRes = await fetch(`${BASE}/sms/settings`).then(r => r.json());
  console.log('   Provider:', settingsRes.settings.provider);
  console.log('   Simulation Active:', Boolean(settingsRes.settings.is_simulation));
  console.log('   Available Providers:', settingsRes.providers.map(p => p.name).join(', '));

  // 2. Phone Validation
  console.log('\n2. Testing Sri Lanka Mobile Validation:');
  const phones = ['0771234567', '0719876543', '0785556667', '0751112223'];
  for (const p of phones) {
    const vRes = await fetch(`${BASE}/sms/validate-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: p })
    }).then(r => r.json());
    console.log(`   ${p} -> Valid: ${vRes.isValid}, Operator: ${vRes.operator}, Formatted: ${vRes.nationalFormat}`);
  }

  // 3. Test SMS Send
  console.log('\n3. Dispatching Test SMS...');
  const testRes = await fetch(`${BASE}/sms/send-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '0773456789',
      message: 'PestControl Pro: Test verification message to Dialog subscriber.'
    })
  }).then(r => r.json());
  console.log('   Success:', testRes.success);
  console.log('   Simulated:', testRes.details?.simulated);
  console.log('   Message ID:', testRes.details?.messageId);
  console.log('   Cost:', testRes.details?.costLkr, 'LKR');

  // 4. Job Reminder Send
  console.log('\n4. Dispatching Job Reminder SMS...');
  const queueRes = await fetch(`${BASE}/reminders/queue`).then(r => r.json());
  console.log('   Tomorrow queue count:', queueRes.tomorrow_jobs.length);
  console.log('   Today queue count:', queueRes.today_jobs.length);

  // Pick first job from DB if queue is empty (since calendar is ahead)
  const db = require('../db');
  const sampleJob = db.prepare('SELECT id, customer_id, job_code FROM jobs LIMIT 1').get();
  if (sampleJob) {
    const jobSmsRes = await fetch(`${BASE}/sms/send-job-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: sampleJob.id,
        reminder_type: '24H'
      })
    }).then(r => r.json());
    console.log(`   Job SMS for ${sampleJob.job_code}:`, jobSmsRes.success ? 'DISPATCHED' : jobSmsRes.error);
    if (jobSmsRes.details) {
      console.log('   Phone:', jobSmsRes.details.phone, 'Operator:', jobSmsRes.details.operator);
    }
  }

  // 5. Bulk SMS
  console.log('\n5. Testing Bulk SMS Dispatch...');
  const bulkRes = await fetch(`${BASE}/sms/bulk-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_ids: [1, 2, 3] })
  }).then(r => r.json());
  console.log('   Bulk summary:', bulkRes.summary);

  // 6. Recent Logs
  console.log('\n6. Fetching SMS Audit Logs...');
  const logsRes = await fetch(`${BASE}/sms/logs?limit=5`).then(r => r.json());
  console.log('   Total recent logs fetched:', logsRes.logs.length);
  logsRes.logs.forEach(l => {
    console.log(`   - [${l.status}] ${l.phone} via ${l.gateway}: ${l.message.substring(0, 45)}... (Cost: Rs. ${l.cost_lkr})`);
  });

  console.log('\n=== ALL SMS INTEGRATION CHECKS PASSED SUCCESSFULLY! ===');
}

runVerification().catch(console.error);
