const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { previewSheet, importSheetData } = require('../services/excelImporter');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upload_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

const DEFAULT_EXCEL = 'e:/pest-system/MASTER SHEDULE ~ @2026.xlsx';

// Get available sheets
router.get('/sheets', (req, res) => {
  const filePath = req.query.file_path || DEFAULT_EXCEL;

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `File not found: ${filePath}` });
    }
    const wb = xlsx.readFile(filePath);
    res.json({
      success: true,
      filePath,
      sheetNames: wb.SheetNames
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload new Excel file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  try {
    const wb = xlsx.readFile(req.file.path);
    res.json({
      success: true,
      filePath: req.file.path,
      originalName: req.file.originalname,
      sheetNames: wb.SheetNames
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Preview sheet column mapping and duplicates
router.post('/preview', (req, res) => {
  const { file_path, sheet_name } = req.body;
  const filePath = file_path || DEFAULT_EXCEL;

  if (!sheet_name) {
    return res.status(400).json({ success: false, error: 'sheet_name is required' });
  }

  try {
    const preview = previewSheet(filePath, sheet_name);
    res.json({ success: true, preview });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Execute import
router.post('/execute', (req, res) => {
  const { file_path, sheet_name, column_mapping } = req.body;
  const filePath = file_path || DEFAULT_EXCEL;

  if (!sheet_name) {
    return res.status(400).json({ success: false, error: 'sheet_name is required' });
  }

  try {
    const result = importSheetData(filePath, sheet_name, column_mapping);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
