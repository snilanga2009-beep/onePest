const db = require('../db');

console.log('Migrating sms_settings to support TEXT_LK and system_url...');

const tx = db.transaction(() => {
  // Check existing data
  const existing = db.prepare('SELECT * FROM sms_settings WHERE id = 1').get();

  db.exec(`
    CREATE TABLE IF NOT EXISTS sms_settings_temp (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      provider TEXT NOT NULL DEFAULT 'TEXT_LK',
      api_key TEXT,
      api_token TEXT,
      user_id TEXT,
      sender_id TEXT DEFAULT 'TextLKDemo',
      password TEXT,
      endpoint_url TEXT,
      system_url TEXT DEFAULT '',
      is_simulation INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (existing) {
    db.prepare(`
      INSERT OR REPLACE INTO sms_settings_temp (
        id, provider, api_key, api_token, user_id, sender_id, password, endpoint_url, system_url, is_simulation, is_active, updated_at
      ) VALUES (
        @id, @provider, @api_key, @api_token, @user_id, @sender_id, @password, @endpoint_url, '', @is_simulation, @is_active, @updated_at
      )
    `).run({
      id: existing.id,
      provider: existing.provider || 'TEXT_LK',
      api_key: existing.api_key || '',
      api_token: existing.api_token || '',
      user_id: existing.user_id || '',
      sender_id: existing.sender_id || 'TextLKDemo',
      password: existing.password || '',
      endpoint_url: existing.endpoint_url || '',
      is_simulation: existing.is_simulation,
      is_active: existing.is_active,
      updated_at: existing.updated_at
    });
  }

  db.exec(`
    DROP TABLE sms_settings;
    ALTER TABLE sms_settings_temp RENAME TO sms_settings;
  `);
});

tx();
console.log('Migration successful!');

// Now test setting provider to TEXT_LK
db.prepare("UPDATE sms_settings SET provider = 'TEXT_LK', sender_id = 'TextLKDemo' WHERE id = 1").run();
console.log('Successfully set provider to TEXT_LK:', db.prepare('SELECT * FROM sms_settings WHERE id = 1').get());
