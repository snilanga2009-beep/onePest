const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const {
  listBackups,
  createBackup,
  deleteBackup,
  restoreBackup,
  getDatabaseStats,
  getBackupPath,
  LIVE_DB_PATH
} = require('../services/backupService');

/**
 * GET /api/backup
 * Get backup stats and list of all backups
 */
router.get('/', (req, res) => {
  try {
    const stats = getDatabaseStats();
    const backups = listBackups();
    res.json({
      success: true,
      stats,
      backups
    });
  } catch (err) {
    console.error('[Backup Route Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/create
 * Trigger manual or monthly backup creation
 */
router.post('/create', async (req, res) => {
  const { type = 'MANUAL_INSTANT', notes = '' } = req.body;
  try {
    const backup = await createBackup(type, notes);
    res.json({
      success: true,
      message: `Database backup created successfully: ${backup.filename}`,
      backup
    });
  } catch (err) {
    console.error('[Create Backup Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/download/:id
 * Download specific backup file
 */
router.get('/download/:id', (req, res) => {
  try {
    const fileInfo = getBackupPath(req.params.id);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Backup file not found' });
    }

    res.download(fileInfo.filepath, fileInfo.filename);
  } catch (err) {
    console.error('[Download Backup Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/download-live
 * Directly download the current live SQLite database
 */
router.get('/download-live', async (req, res) => {
  try {
    if (!fs.existsSync(LIVE_DB_PATH)) {
      return res.status(404).json({ success: false, error: 'Live database file not found' });
    }

    const tempDownloadPath = path.join(__dirname, `../data/backups/live-export-${Date.now()}.db`);
    const db = require('../db');
    await db.backup(tempDownloadPath);

    const nowStr = new Date().toISOString().substring(0, 10);
    res.download(tempDownloadPath, `pest_control_live_${nowStr}.db`, (err) => {
      if (fs.existsSync(tempDownloadPath)) {
        try { fs.unlinkSync(tempDownloadPath); } catch (e) {}
      }
    });
  } catch (err) {
    console.error('[Download Live DB Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/restore/:id
 * Restore database from an existing backup snapshot
 */
router.post('/restore/:id', async (req, res) => {
  try {
    const result = await restoreBackup(req.params.id);
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    console.error('[Restore Backup Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/backup/:id
 * Delete a backup snapshot
 */
router.delete('/:id', (req, res) => {
  try {
    const result = deleteBackup(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[Delete Backup Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
