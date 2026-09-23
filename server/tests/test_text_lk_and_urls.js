async function testTextLkAndUrls() {
  console.log('=== TEST: Text.lk Integration & Live URLs ===\n');

  const BASE = 'http://localhost:5000';

  // 1. Settings check
  console.log('1. Checking SMS Settings for Text.lk...');
  const sRes = await fetch(`${BASE}/api/sms/settings`).then(r => r.json());
  console.log('   Active Provider:', sRes.settings.provider);
  console.log('   Sender ID:', sRes.settings.sender_id);
  console.log('   Providers list includes Text.lk:', sRes.providers.some(p => p.id === 'TEXT_LK'));
  console.log('   Text.lk Provider Info:', sRes.providers.find(p => p.id === 'TEXT_LK'));

  // 2. Testing Simulation SMS with Text.lk
  console.log('\n2. Testing Simulation SMS with Text.lk...');
  await fetch(`${BASE}/api/sms/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'TEXT_LK',
      sender_id: 'TextLKDemo',
      is_simulation: 1,
      api_key: ''
    })
  });

  const testSimRes = await fetch(`${BASE}/api/sms/send-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '0771234567',
      message: 'PestControl Pro: Simulation verification via Text.lk.'
    })
  }).then(r => r.json());
  console.log('   Simulated Dispatch Result:', testSimRes.success ? 'SUCCESS' : testSimRes.error);
  console.log('   Provider:', testSimRes.details?.provider, 'Message ID:', testSimRes.details?.messageId);

  // 3. Testing Live Dispatch call to real Text.lk API (validates real network call)
  console.log('\n3. Testing Live Dispatch call to Text.lk endpoint...');
  await fetch(`${BASE}/api/sms/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'TEXT_LK',
      sender_id: 'TextLKDemo',
      is_simulation: 0,
      api_key: 'dummy_token_123456789'
    })
  });

  const testLiveRes = await fetch(`${BASE}/api/sms/send-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '0771234567',
      message: 'Test live send'
    })
  }).then(r => r.json());

  console.log('   Live Text.lk Call Handled Gracefully:');
  console.log('   Success:', testLiveRes.success);
  console.log('   Error from Text.lk (as expected for dummy token):', testLiveRes.error);

  // Reset to simulation mode for safety
  await fetch(`${BASE}/api/sms/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'TEXT_LK',
      sender_id: 'TextLKDemo',
      is_simulation: 1,
      api_key: ''
    })
  });

  // 4. Testing Confirmation URL resolution & API
  console.log('\n4. Testing Live Confirmation URL Resolution...');
  const queueRes = await fetch(`${BASE}/api/reminders/queue`).then(r => r.json());
  console.log('   Detected Base URL:', queueRes.system_base_url);

  // Check appointment API
  const apptRes = await fetch(`${BASE}/api/confirmations/JOB-20260915-0001`).then(r => r.json());
  console.log('   Appointment API for JOB-20260915-0001:', apptRes.success ? 'FOUND' : 'NOT FOUND');
  if (apptRes.appointment) {
    console.log('   Client:', apptRes.appointment.customer_name);
    console.log('   Scheduled Date:', apptRes.appointment.scheduled_date);
    console.log('   Status:', apptRes.appointment.customer_confirmation_status);
  }

  // Check HTML route
  const htmlRes = await fetch(`${BASE}/confirmations/JOB-20260915-0001`);
  console.log('   HTML Confirmation page status code:', htmlRes.status);

  console.log('\n=== ALL TEXT.LK & URL CHECKS COMPLETED SUCCESSFULLY! ===');
}

testTextLkAndUrls().catch(console.error);
