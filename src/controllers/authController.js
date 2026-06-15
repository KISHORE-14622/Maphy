const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(200).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const pool = await getPool();
    
    // Fetch user with their group permission info
    const [rows] = await pool.query(
      `SELECT u.*, g.permissions 
       FROM users u 
       LEFT JOIN \`groups\` g ON u.group_id = g.id 
       WHERE u.email = ? AND u.deleted_at IS NULL`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(200).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(200).json({ success: false, message: 'Invalid email or password' });
    }

    // Parse permissions
    let permissions = {};
    if (user.permissions) {
      try {
        permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      } catch (parseError) {
        console.error('Failed to parse group permissions:', parseError);
      }
    }

    // Default payload firmId = company_id or 1
    const firmId = user.company_id || 1;

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        firmId: firmId,
        firstName: user.first_name,
        lastName: user.last_name
      },
      process.env.JWT_SECRET || 'maphy_jwt_secret_key_2026_xyz',
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken: token,
      permissions: permissions
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  login
};
