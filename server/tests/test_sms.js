const {
  normalizeSriLankaPhone,
  getSmsSettings,
  updateSmsSettings,
  sendSMS
} = require('../services/smsGateway');
const db = require('../db');

console.log('=== TEST 1: Phone Normalizer for Sri Lanka ===');
const testNumbers = [
  '0771234567',
  '+94 77 123 4567',
  '771234567',
  '0719876543',
  '0701122334',
  '0765544332',
  '0789988776',
  '0751234567',
  '12345',
  '0112345678' // landline
];

testNumbers.forEach(n => {
  const res = normalizeSriLankaPhone(n);
  console.log(`Input: "${n}" -> Valid: ${res.isValid}, Normalized: ${res.normalized || 'N/A'}, Operator: ${res.operator || 'N/A'}`);
});

console.log('\n=== TEST 2: SMS Settings & Simulation Mode ===');
const settings = getSmsSettings();
console.log('Current SMS Settings:', {
  provider: settings.provider,
  sender_id: settings.sender_id,
  is_simulation: settings.is_simulation
});

console.log('\n=== TEST 3: Sending Simulated SMS ===');
(async () => {
  // Find a sample job from DB
  const sampleJob = db.prepare('SELECT id, customer_id FROM jobs LIMIT 1').get();

  const sendResult = await sendSMS({
    to: '0771234567',
    message: 'PestControl Pro: Your monthly treatment is scheduled for tomorrow at 09:30 AM.',
    jobId: sampleJob?.id || null,
    recipientName: 'Sampath Perera'
  });

  console.log('Send Result:', sendResult);

  // Check logs
  const logs = db.prepare('SELECT * FROM sms_logs ORDER BY id DESC LIMIT 1').all();
  console.log('Latest SMS Log entry in DB:', logs);

  console.log('\nAll SMS tests executed successfully!');
})();
