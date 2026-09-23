const db = require('../db');
try {
  db.prepare("UPDATE sms_settings SET provider = 'TEXT_LK' WHERE id = 1").run();
  console.log('Update TEXT_LK SUCCESS');
} catch (e) {
  console.log('Update Error:', e.message);
}
