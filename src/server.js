const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { initializeDatabase } = require('./config/db');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if not exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/v1', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Resource not found' });
});

// Global Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// Boot server
async function boot() {
  try {
    // 1. Initialize DB tables & seed baseline values
    await initializeDatabase();
    
    // 2. Start listening
    app.listen(PORT, () => {
      console.log(`===================================================`);
      console.log(` Maphy ALM Backend running on http://localhost:${PORT}`);
      console.log(` API base path: http://localhost:${PORT}/api/v1`);
      console.log(`===================================================`);
    });
  } catch (error) {
    console.error('FATAL: Failed to boot server:', error);
    process.exit(1);
  }
}

boot();
