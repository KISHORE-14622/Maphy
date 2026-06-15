const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const authMiddleware = (req, res, next) => {
  // Allow login endpoint without token
  if (req.path === '/users/login') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ success: false, message: 'No authorization header provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(403).json({ success: false, message: 'Authentication token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'maphy_jwt_secret_key_2026_xyz');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verify error:', error.message);
    return res.status(403).json({ success: false, message: 'Invalid or expired authorization token' });
  }
};

module.exports = authMiddleware;
