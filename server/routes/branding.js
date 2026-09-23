const express = require('express');
const router = express.Router();
const db = require('../db');

// Ensure app_branding table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS app_branding (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT 'Ceylon Pest Solutions',
    subheading TEXT DEFAULT 'Master Operations & Scheduling Suite',
    logo_type TEXT DEFAULT 'preset',
    preset_id TEXT DEFAULT 'shield',
    custom_logo_url TEXT DEFAULT '',
    app_icon_url TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO app_branding (id, name, subheading, logo_type, preset_id, custom_logo_url, app_icon_url)
  VALUES (1, 'Ceylon Pest Solutions', 'Master Operations & Scheduling Suite', 'preset', 'shield', '', '');
`);

/**
 * GET /api/branding
 * Retrieve current system branding & logo settings
 */
router.get('/', (req, res) => {
  try {
    let branding = db.prepare('SELECT * FROM app_branding WHERE id = 1').get();
    if (!branding) {
      branding = {
        id: 1,
        name: 'Ceylon Pest Solutions',
        subheading: 'Master Operations & Scheduling Suite',
        logo_type: 'preset',
        preset_id: 'shield',
        custom_logo_url: '',
        app_icon_url: ''
      };
    }

    res.json({
      success: true,
      branding: {
        name: branding.name,
        subheading: branding.subheading,
        logoType: branding.logo_type,
        presetId: branding.preset_id,
        customLogoUrl: branding.custom_logo_url || '',
        appIconUrl: branding.app_icon_url || '',
        updatedAt: branding.updated_at
      }
    });
  } catch (err) {
    console.error('[Get Branding Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/branding
 * Update system branding, dashboard logo, and app icon logo
 */
router.put('/', (req, res) => {
  const {
    name,
    subheading,
    logoType,
    presetId,
    customLogoUrl,
    appIconUrl
  } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM app_branding WHERE id = 1').get();

    const finalName = name !== undefined ? name : (existing ? existing.name : 'Ceylon Pest Solutions');
    const finalSubheading = subheading !== undefined ? subheading : (existing ? existing.subheading : 'Master Operations & Scheduling Suite');
    const finalLogoType = logoType !== undefined ? logoType : (existing ? existing.logo_type : 'preset');
    const finalPresetId = presetId !== undefined ? presetId : (existing ? existing.preset_id : 'shield');
    const finalCustomLogoUrl = customLogoUrl !== undefined ? customLogoUrl : (existing ? existing.custom_logo_url : '');
    const finalAppIconUrl = appIconUrl !== undefined ? appIconUrl : (existing ? existing.app_icon_url : '');

    db.prepare(`
      INSERT INTO app_branding (id, name, subheading, logo_type, preset_id, custom_logo_url, app_icon_url, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        subheading = excluded.subheading,
        logo_type = excluded.logo_type,
        preset_id = excluded.preset_id,
        custom_logo_url = excluded.custom_logo_url,
        app_icon_url = excluded.app_icon_url,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      finalName,
      finalSubheading,
      finalLogoType,
      finalPresetId,
      finalCustomLogoUrl,
      finalAppIconUrl
    );

    const updated = db.prepare('SELECT * FROM app_branding WHERE id = 1').get();

    res.json({
      success: true,
      message: 'Branding, dashboard logo, and app icon updated successfully.',
      branding: {
        name: updated.name,
        subheading: updated.subheading,
        logoType: updated.logo_type,
        presetId: updated.preset_id,
        customLogoUrl: updated.custom_logo_url || '',
        appIconUrl: updated.app_icon_url || '',
        updatedAt: updated.updated_at
      }
    });
  } catch (err) {
    console.error('[Update Branding Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
