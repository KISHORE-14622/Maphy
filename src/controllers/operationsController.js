const crypto = require('crypto');
const { getPool } = require('../config/db');

const formatDate = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

// ==========================================
// AUDITS ENDPOINTS
// ==========================================

const getAudits = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';

  try {
    const pool = await getPool();
    let whereClause = ' WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (a.title LIKE ? OR h.name LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM audits a LEFT JOIN hardware h ON a.asset_id = h.id ${whereClause}`,
      queryParams
    );

    const sql = `
      SELECT a.*, h.name as asset_name, h.asset_tag 
      FROM audits a
      LEFT JOIN hardware h ON a.asset_id = h.id
      ${whereClause}
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...queryParams, limit, offset]);
    
    const formatted = rows.map(r => ({
      ...r,
      last_audit_date: formatDate(r.last_audit_date),
      next_audit_date: formatDate(r.next_audit_date),
      created_at: formatDate(r.created_at)
    }));

    return res.status(200).json({ success: true, rows: formatted, total });
  } catch (err) {
    console.error('Error fetching audits:', err);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

const createAudit = async (req, res) => {
  const { asset_id, title, last_audit_date, next_audit_date, notes } = req.body;
  
  if (!asset_id) {
    return res.status(200).json({ success: false, message: 'Asset selection is required' });
  }

  try {
    const pool = await getPool();
    const sql = `
      INSERT INTO audits (asset_id, title, last_audit_date, next_audit_date, notes) 
      VALUES (?, ?, ?, ?, ?)`;

    await pool.query(sql, [
      asset_id,
      title || 'Asset Audit',
      last_audit_date || null,
      next_audit_date || null,
      notes || ''
    ]);

    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'audit', 'hardware', asset_id, `Audited hardware ID: ${asset_id}`]
    );

    return res.status(201).json({ success: true, message: 'Audit recorded successfully' });
  } catch (err) {
    console.error('Error creating audit:', err);
    return res.status(500).json({ success: false, message: 'Database insert error' });
  }
};

// ==========================================
// SHORT URL ENDPOINTS
// ==========================================

const createShortUrl = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(200).json({ success: false, message: 'Long URL is required' });
  }

  try {
    const pool = await getPool();
    
    // Generate a random 6 character code
    const shortCode = crypto.randomBytes(3).toString('hex');
    
    await pool.query(
      'INSERT INTO shorturls (long_url, short_code) VALUES (?, ?)',
      [url, shortCode]
    );

    const protocol = req.secure ? 'https' : 'http';
    const shortUrl = `${protocol}://${req.headers.host}/api/v1/shorturl/${shortCode}`;

    return res.status(200).json({
      success: true,
      short_url: shortUrl
    });
  } catch (err) {
    console.error('Error creating short url:', err);
    return res.status(500).json({ success: false, message: 'Short URL creation failed' });
  }
};

const redirectShortUrl = async (req, res) => {
  const { code } = req.params;

  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT long_url FROM shorturls WHERE short_code = ?', [code]);

    if (rows.length === 0) {
      return res.status(404).send('Short URL not found');
    }

    return res.redirect(rows[0].long_url);
  } catch (err) {
    console.error('Error redirecting short URL:', err);
    return res.status(500).send('Redirect error');
  }
};

// ==========================================
// SETTINGS ENDPOINTS (Branding, Slack, Labels)
// ==========================================

const getSetting = (settingKey) => async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT setting_value FROM settings WHERE setting_key = ?', [settingKey]);

    if (rows.length === 0) {
      return res.status(200).json({});
    }

    const val = typeof rows[0].setting_value === 'string' ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
    return res.status(200).json(val);
  } catch (err) {
    console.error(`Error reading setting key ${settingKey}:`, err);
    return res.status(500).json({ success: false, message: 'Database fetch error' });
  }
};

const updateSetting = (settingKey) => async (req, res) => {
  const data = req.body;
  const logoFile = req.file;

  try {
    const pool = await getPool();
    let payload = { ...data };

    if (logoFile) {
      payload.logo = `uploads/${logoFile.filename}`;
    }

    const valueStr = JSON.stringify(payload);

    await pool.query(
      `INSERT INTO settings (setting_key, setting_value) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [settingKey, valueStr, valueStr]
    );

    return res.status(200).json({ success: true, message: `${settingKey} updated successfully` });
  } catch (err) {
    console.error(`Error updating setting key ${settingKey}:`, err);
    return res.status(500).json({ success: false, message: 'Database update error' });
  }
};

module.exports = {
  // Audits
  getAudits,
  createAudit,

  // Short URL
  createShortUrl,
  redirectShortUrl,

  // Config settings
  getBranding: getSetting('branding'),
  updateBranding: updateSetting('branding'),
  getLabels: getSetting('labels'),
  updateLabels: updateSetting('labels'),
  getSlack: getSetting('slack'),
  updateSlack: updateSetting('slack')
};
