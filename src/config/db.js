const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { SCHEMAS } = require('./schema');

const envPath = path.join(__dirname, '../../.env');
console.log('[DB DIAGNOSTIC] Target .env path:', envPath);
try {
  console.log('[DB DIAGNOSTIC] Raw .env text:\n', fs.readFileSync(envPath, 'utf8'));
} catch (err) {
  console.error('[DB DIAGNOSTIC] fs.readFileSync error:', err.message);
}

const dotenvResult = require('dotenv').config({ path: envPath });
console.log('[DB DIAGNOSTIC] Dotenv parsed result:', dotenvResult.parsed);
if (dotenvResult.error) {
  console.error('[DB DIAGNOSTIC] Dotenv loading error:', dotenvResult.error);
}
console.log('[DB DIAGNOSTIC] Raw DB_PASSWORD env:', JSON.stringify(process.env.DB_PASSWORD));

console.log(`[DB INITIALIZATION] Connecting to ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '3306'} as ${process.env.DB_USER || 'root'} (Password provided: ${process.env.DB_PASSWORD ? 'YES' : 'NO'})`);




let pool = null;

async function getPool() {
  if (pool) return pool;

  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'maphy_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };

  // Create pool
  pool = mysql.createPool(config);
  return pool;
}

async function initializeDatabase() {
  try {
    // 1. Establish connection to server first (in case database doesn't exist)
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    const dbName = process.env.DB_NAME || 'maphy_db';
    console.log(`Verifying/Creating database "${dbName}"...`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await conn.end();

    // 2. Get connection pool for the specific database
    const dbPool = await getPool();

    // 3. Create tables sequentially
    for (const sql of SCHEMAS) {
      await dbPool.query(sql);
    }
    console.log('Database tables verified/created successfully.');

    // 4. Seed default data if empty
    await seedDefaultData(dbPool);

  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}

async function seedDefaultData(dbPool) {
  try {
    // Check if permission groups exist
    const [groups] = await dbPool.query('SELECT id FROM `groups` LIMIT 1');
    if (groups.length === 0) {
      console.log('Seeding default groups and permissions...');
      const adminPerms = {
        superuser: "1",
        admin: true,
        import: true,
        reportview: true,
        assetsaudit: true,
        assetscheckin: true,
        assetscheckout: true,
        assetscreate: true,
        assetsdelete: true,
        assetsedit: true,
        assetsview: true,
        assetsviewrequestable: true,
        accessoriescheckin: true,
        accessoriescheckout: true,
        accessoriescreate: true,
        accessoriesdelete: true,
        accessoriesedit: true,
        accessoriesview: true,
        consumablescheckout: true,
        consumablescreate: true,
        consumablesdelete: true,
        consumablesedit: true,
        consumablesview: true,
        licensescheckout: true,
        licensescheckin: true,
        licensescreate: true,
        licensesdelete: true,
        licensesedit: true,
        licensesview: true,
        componentscheckin: true,
        componentscheckout: true,
        componentscreate: true,
        componentsdelete: true,
        componentsedit: true,
        componentsview: true,
        userscreate: true,
        usersdelete: true,
        usersedit: true,
        usersview: true,
        modelscreate: true,
        modelsdelete: true,
        modelsedit: true,
        modelsview: true,
        categoriescreate: true,
        categoriesdelete: true,
        categoriesedit: true,
        categoriesview: true,
        departmentscreate: true,
        departmentsdelete: true,
        departmentsedit: true,
        departmentsview: true,
        statuslabelscreate: true,
        statuslabelsdelete: true,
        statuslabelsedit: true,
        statuslabelsview: true,
        supplierscreate: true,
        suppliersdelete: true,
        suppliersedit: true,
        suppliersview: true,
        manufacturerscreate: true,
        manufacturersdelete: true,
        manufacturersedit: true,
        manufacturersview: true,
        locationscreate: true,
        locationsdelete: true,
        locationsedit: true,
        locationsview: true,
        companiescreate: true,
        companiesdelete: true,
        companiesedit: true,
        companiesview: true,
        depreciationscreate: true,
        depreciationsdelete: true,
        depreciationsedit: true,
        depreciationsview: true,
        selfapi: true
      };

      await dbPool.query(
        'INSERT INTO `groups` (id, name, permissions) VALUES (?, ?, ?)',
        [1, 'Super Administrator', JSON.stringify(adminPerms)]
      );
    }

    // Check if companies exist
    const [companies] = await dbPool.query('SELECT id FROM companies LIMIT 1');
    if (companies.length === 0) {
      console.log('Seeding default company...');
      await dbPool.query('INSERT INTO companies (id, name) VALUES (?, ?)', [1, 'Maphy Corp']);
    }

    // Check if locations exist
    const [locations] = await dbPool.query('SELECT id FROM locations LIMIT 1');
    if (locations.length === 0) {
      console.log('Seeding default location...');
      await dbPool.query(
        'INSERT INTO locations (id, name, city, state, country) VALUES (?, ?, ?, ?, ?)',
        [1, 'Headquarters Office', 'Chennai', 'Tamil Nadu', 'India']
      );
    }

    // Check if users exist
    const [users] = await dbPool.query('SELECT id FROM users LIMIT 1');
    if (users.length === 0) {
      console.log('Seeding default administrator...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      await dbPool.query(
        'INSERT INTO users (id, first_name, last_name, email, password, username, group_id, company_id, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [1, 'Admin', 'User', 'admin@maphy.com', hashedPassword, 'admin', 1, 1, 1]
      );
    }

    // Check if status labels exist
    const [statusLabels] = await dbPool.query('SELECT id FROM status_labels LIMIT 1');
    if (statusLabels.length === 0) {
      console.log('Seeding default status labels...');
      await dbPool.query(
        'INSERT INTO status_labels (id, name, type, notes) VALUES ' +
        '(1, "Ready to Deploy", "deployable", "Asset can be checked out immediately"),' +
        '(2, "Deployed", "deployable", "Asset is currently checked out to a user/location"),' +
        '(3, "Archived", "archived", "Asset cannot be checked out (historical data)"),' +
        '(4, "Pending", "pending", "Asset is awaiting setup or validation"),' +
        '(5, "Broken", "undeployable", "Asset is damaged and requires repair")'
      );
    }

    // Check if categories exist
    const [categories] = await dbPool.query('SELECT id FROM categories LIMIT 1');
    if (categories.length === 0) {
      console.log('Seeding default categories...');
      await dbPool.query(
        'INSERT INTO categories (id, name, category_type) VALUES ' +
        '(1, "Laptops", "asset"),' +
        '(2, "Keyboards", "accessory"),' +
        '(3, "Printers", "asset"),' +
        '(4, "Monitors", "asset"),' +
        '(5, "Software Licences", "license"),' +
        '(6, "RAM Modules", "component"),' +
        '(7, "Printer Ink cartridges", "consumable")'
      );
    }

    // Check if settings exist
    const [settings] = await dbPool.query('SELECT id FROM settings LIMIT 1');
    if (settings.length === 0) {
      console.log('Seeding default settings...');
      await dbPool.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES ' +
        '("branding", \'{"name":"Maphy Assets","logo":null,"theme":"dark"}\'),' +
        '("labels", \'{"width":100,"height":50,"show_tag":true}\'),' +
        '("slack", \'{"webhook_url":"","enabled":0}\')'
      );
    }

    console.log('Database seeding verified.');
  } catch (error) {
    console.error('Error seeding default data:', error);
    throw error;
  }
}

module.exports = {
  getPool,
  initializeDatabase
};
