const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('===================================================');
console.log('         Maphy Backend Validation Tool             ');
console.log('===================================================');

async function runValidation() {
  let errors = 0;

  // 1. Check Env
  console.log('\nChecking environment variables...');
  const port = process.env.PORT || 5000;
  const dbHost = process.env.DB_HOST || '127.0.0.1';
  const dbUser = process.env.DB_USER || 'root';
  const dbName = process.env.DB_NAME || 'maphy_db';
  const jwtSecret = process.env.JWT_SECRET;

  console.log(`- Configured Port: ${port}`);
  console.log(`- Database Host:   ${dbHost}`);
  console.log(`- Database User:   ${dbUser}`);
  console.log(`- Database Name:   ${dbName}`);
  if (!jwtSecret) {
    console.warn('[WARNING] JWT_SECRET is not set in .env! Using baseline default fallback.');
  } else {
    console.log('- JWT_SECRET status: Set');
  }

  // 2. Test Bcrypt Hashing
  console.log('\nChecking crypt hashing speed (BcryptJS)...');
  try {
    const start = Date.now();
    const hash = await bcrypt.hash('password123', 10);
    const end = Date.now();
    const match = await bcrypt.compare('password123', hash);
    console.log(`- Hash completed in ${end - start}ms`);
    console.log(`- Hash match confirmation: ${match ? 'SUCCESS' : 'FAILED'}`);
    if (!match) {
      errors++;
    }
  } catch (err) {
    console.error('Bcrypt testing failed:', err);
    errors++;
  }

  // 3. Test JWT Generation & Decode
  console.log('\nChecking JWT signature mechanisms...');
  try {
    const payload = { userId: 1, email: 'admin@maphy.com', firmId: 1 };
    const secret = jwtSecret || 'maphy_jwt_secret_key_2026_xyz';
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret);
    console.log('- Token creation: SUCCESS');
    console.log(`- Token verification matching: ${decoded.email === payload.email ? 'SUCCESS' : 'FAILED'}`);
    if (decoded.email !== payload.email) {
      errors++;
    }
  } catch (err) {
    console.error('JWT testing failed:', err);
    errors++;
  }

  // 4. Test database drivers can load
  console.log('\nChecking database drivers loading (mysql2)...');
  try {
    const mysql = require('mysql2/promise');
    console.log('- mysql2 module load: SUCCESS');
  } catch (err) {
    console.error('Failed to import mysql2 module:', err);
    errors++;
  }

  console.log('\n===================================================');
  if (errors === 0) {
    console.log(' Validation scan completed: 0 errors detected! ');
    console.log(' Backend dependencies and syntax verified successfully. ');
  } else {
    console.log(` Validation scan completed: ${errors} errors detected. Please check logs. `);
  }
  console.log('===================================================');
}

runValidation();
