const fs = require('fs');
const path = require('path');
const db = require('../db');

const BACKUP_DIR = path.join(__dirname, '../data/backups');
const LIVE_DB_PATH = path.join(__dirname, '../data/pest_control.db');

/**
 * Format bytes to readable string (e.g. 1.25 MB)
 */
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Get Colombo current date components
 */
function getColomboNow() {
  const d = new Date();
  const colomboStr = d.toLocaleString('en-CA', { timeZone: 'Asia/Colombo' }); // YYYY-MM-DD, HH:mm:ss
  const datePart = colomboStr.split(',')[0].trim(); // YYYY-MM-DD
  const monthKey = datePart.substring(0, 7); // YYYY-MM
  return { datePart, monthKey, now: d };
}

/**
 * Initialize backups folder and metadata table
 */
function initBackupSystem() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS database_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      filepath TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      backup_type TEXT NOT NULL, -- 'MONTHLY_AUTO', 'MANUAL_INSTANT'
      month_key TEXT,            -- 'YYYY-MM'
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_backups_month ON database_backups(month_key);
    CREATE INDEX IF NOT EXISTS idx_backups_type ON database_backups(backup_type);
  `);

  // Run immediate monthly backup check on server boot
  checkAndRunMonthlyBackup().catch(err => {
    console.error('[Backup Service] Initial monthly backup check error:', err.message);
  });

  // Schedule background check every 6 hours
  setInterval(() => {
    checkAndRunMonthlyBackup().catch(err => {
      console.error('[Backup Service] Periodic monthly backup check error:', err.message);
    });
  }, 6 * 60 * 60 * 1000);
}

/**
 * Check if the current month has an automatic backup; if not, create one!
 */
async function checkAndRunMonthlyBackup() {
  const { monthKey } = getColomboNow();

  const existing = db.prepare(`
    SELECT * FROM database_backups
    WHERE backup_type = 'MONTHLY_AUTO' AND month_key = ?
  `).get(monthKey);

  if (!existing) {
    console.log(`[Backup Service] No monthly backup found for ${monthKey}. Creating automated monthly archive...`);
    try {
      const backup = await createBackup('MONTHLY_AUTO', `Automated scheduled monthly backup for ${monthKey}`);
      console.log(`[Backup Service] ✓ Successfully created monthly backup for ${monthKey}: ${backup.filename} (${formatBytes(backup.size_bytes)})`);
      return backup;
    } catch (err) {
      console.error(`[Backup Service] ✕ Failed to create monthly backup for ${monthKey}:`, err);
      throw err;
    }
  }

  return existing;
}

/**
 * Create a live database backup snapshot
 * @param {'MONTHLY_AUTO'|'MANUAL_INSTANT'} type
 * @param {string} notes
 */
async function createBackup(type = 'MANUAL_INSTANT', notes = '') {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const { datePart, monthKey } = getColomboNow();
  const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
  
  let filename = '';
  if (type === 'MONTHLY_AUTO') {
    filename = `monthly-backup-${monthKey}.db`;
  } else {
    filename = `backup-${datePart}-${timeStr}-manual.db`;
  }

  const destPath = path.join(BACKUP_DIR, filename);

  // If a file with the same name exists, add random suffix
  let finalPath = destPath;
  let finalFilename = filename;
  if (fs.existsSync(finalPath) && type !== 'MONTHLY_AUTO') {
    const rand = Math.floor(Math.random() * 1000);
    finalFilename = filename.replace('.db', `-${rand}.db`);
    finalPath = path.join(BACKUP_DIR, finalFilename);
  }

  // Use better-sqlite3 native safe online backup
  await db.backup(finalPath);

  const stats = fs.statSync(finalPath);
  const sizeBytes = stats.size;

  // Insert or replace in database_backups
  db.prepare(`
    INSERT INTO database_backups (filename, filepath, size_bytes, backup_type, month_key, status, notes)
    VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?)
    ON CONFLICT(filename) DO UPDATE SET
      size_bytes = excluded.size_bytes,
      status = 'COMPLETED',
      notes = excluded.notes,
      created_at = CURRENT_TIMESTAMP
  `).run(finalFilename, finalPath, sizeBytes, type, monthKey, notes || (type === 'MONTHLY_AUTO' ? `Automated Monthly Backup (${monthKey})` : 'Manual On-demand Backup'));

  const record = db.prepare('SELECT * FROM database_backups WHERE filename = ?').get(finalFilename);

  return {
    ...record,
    size_formatted: formatBytes(record.size_bytes)
  };
}

/**
 * List all backups with file metadata
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Sync any files manually placed in backups directory
  const filesOnDisk = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
  const checkStmt = db.prepare('SELECT id FROM database_backups WHERE filename = ?');
  const insertStmt = db.prepare(`
    INSERT INTO database_backups (filename, filepath, size_bytes, backup_type, month_key, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const file of filesOnDisk) {
    const existing = checkStmt.get(file);
    if (!existing) {
      const p = path.join(BACKUP_DIR, file);
      const st = fs.statSync(p);
      const isMonthly = file.startsWith('monthly-backup-');
      const mKey = isMonthly ? file.replace('monthly-backup-', '').replace('.db', '').substring(0, 7) : null;
      insertStmt.run(
        file,
        p,
        st.size,
        isMonthly ? 'MONTHLY_AUTO' : 'MANUAL_INSTANT',
        mKey,
        isMonthly ? 'Monthly archive detected on disk' : 'Manual backup file'
      );
    }
  }

  const rows = db.prepare(`
    SELECT * FROM database_backups
    ORDER BY created_at DESC, id DESC
  `).all();

  return rows.map(r => {
    const exists = fs.existsSync(r.filepath);
    return {
      id: r.id,
      filename: r.filename,
      filepath: r.filepath,
      size_bytes: r.size_bytes,
      size_formatted: formatBytes(r.size_bytes),
      backup_type: r.backup_type,
      month_key: r.month_key,
      status: exists ? r.status : 'MISSING_ON_DISK',
      notes: r.notes,
      created_at: r.created_at
    };
  });
}

/**
 * Delete a backup file
 */
function deleteBackup(id) {
  const row = db.prepare('SELECT * FROM database_backups WHERE id = ?').get(id);
  if (!row) {
    throw new Error('Backup record not found');
  }

  if (fs.existsSync(row.filepath)) {
    fs.unlinkSync(row.filepath);
  }

  db.prepare('DELETE FROM database_backups WHERE id = ?').run(id);
  return { success: true, message: `Backup ${row.filename} deleted successfully` };
}

/**
 * Restore database from an existing backup snapshot
 */
async function restoreBackup(id) {
  const row = db.prepare('SELECT * FROM database_backups WHERE id = ?').get(id);
  if (!row) {
    throw new Error('Backup record not found');
  }

  if (!fs.existsSync(row.filepath)) {
    throw new Error('Backup file does not exist on disk at ' + row.filepath);
  }

  // 1. Create emergency pre-restore snapshot of current state
  const emergencyFile = path.join(BACKUP_DIR, `emergency-pre-restore-${Date.now()}.db`);
  await db.backup(emergencyFile);

  // 2. Perform restore by copying backup file over live database file
  // Wait for WAL checkpoint before replacement
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {}

  fs.copyFileSync(row.filepath, LIVE_DB_PATH);

  return {
    success: true,
    message: `Database successfully restored from ${row.filename}! A safety emergency snapshot was saved to ${path.basename(emergencyFile)}.`
  };
}

/**
 * Get comprehensive backup and database statistics
 */
function getDatabaseStats() {
  const { monthKey } = getColomboNow();

  let liveDbSizeBytes = 0;
  if (fs.existsSync(LIVE_DB_PATH)) {
    liveDbSizeBytes = fs.statSync(LIVE_DB_PATH).size;
  }

  // Also account for WAL file if active
  const walPath = `${LIVE_DB_PATH}-wal`;
  if (fs.existsSync(walPath)) {
    liveDbSizeBytes += fs.statSync(walPath).size;
  }

  const allBackups = listBackups();
  const totalBackupBytes = allBackups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);
  const monthlyBackupsCount = allBackups.filter(b => b.backup_type === 'MONTHLY_AUTO').length;

  const currentMonthBackup = allBackups.find(b => b.backup_type === 'MONTHLY_AUTO' && b.month_key === monthKey);

  // Calculate next 1st of the month
  const d = new Date();
  const nextMonthDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const nextScheduledDateStr = nextMonthDate.toISOString().substring(0, 10);

  return {
    live_database_size: formatBytes(liveDbSizeBytes),
    live_database_size_bytes: liveDbSizeBytes,
    total_backups_count: allBackups.length,
    monthly_backups_count: monthlyBackupsCount,
    total_storage_used: formatBytes(totalBackupBytes),
    total_storage_used_bytes: totalBackupBytes,
    current_month: monthKey,
    current_month_backup_status: currentMonthBackup ? 'COMPLETED' : 'PENDING_NEXT_TRIGGER',
    current_month_backup_filename: currentMonthBackup ? currentMonthBackup.filename : null,
    next_scheduled_monthly_date: `${nextScheduledDateStr} 00:00 (Asia/Colombo)`,
    auto_monthly_backup_enabled: true
  };
}

/**
 * Get absolute path of backup file for downloading
 */
function getBackupPath(id) {
  const row = db.prepare('SELECT * FROM database_backups WHERE id = ?').get(id);
  if (!row || !fs.existsSync(row.filepath)) {
    return null;
  }
  return { filepath: row.filepath, filename: row.filename };
}

module.exports = {
  initBackupSystem,
  checkAndRunMonthlyBackup,
  createBackup,
  listBackups,
  deleteBackup,
  restoreBackup,
  getDatabaseStats,
  getBackupPath,
  LIVE_DB_PATH
};
