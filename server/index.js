require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Ensure uploads dir
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/treatments', require('./routes/treatments'));
app.use('/api/recurring', require('./routes/recurring'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/import', require('./routes/import'));
app.use('/api/confirmations', require('./routes/confirmations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/automation', require('./routes/automation'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/push', require('./routes/push'));
app.use('/api/tech-auth', require('./routes/techAuth'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/branding', require('./routes/branding'));
app.use('/api/backup', require('./routes/backup'));

// Initialize automated monthly backup system
const { initBackupSystem } = require('./services/backupService');
initBackupSystem();

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Pest Control Master Scheduling System',
    timezone: 'Asia/Colombo',
    serverTime: new Date().toISOString()
  });
});

// Serve static frontend build when available
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Pest Control Master Scheduling System Server Running`);
  console.log(` Port: ${PORT} | Timezone: Asia/Colombo`);
  console.log(` Health: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});

module.exports = app;
