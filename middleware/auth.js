const jwt = require('jsonwebtoken');
const { User, Vendor, AdminUser } = require('../models');

// Verify JWT Token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No user information found.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Verify user exists and is active
const verifyUserStatus = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    let user;

    switch (role) {
      case 'customer':
        user = await User.findByPk(userId);
        break;
      case 'vendor':
        user = await Vendor.findByPk(userId);
        break;
      case 'admin':
        user = await AdminUser.findByPk(userId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user role'
        });
    }

    if (!user || user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account inactive or not found'
      });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying user status',
      error: error.message
    });
  }
};

module.exports = {
  authenticateToken,
  authorize,
  verifyUserStatus
};