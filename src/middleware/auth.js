const jwt = require('jsonwebtoken');
const { AdminUser, User, Vendor } = require('../models');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Middleware to authorize based on role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions'
      });
    }

    next();
  };
};

// Middleware to verify user status
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive or suspended'
      });
    }

    // For vendors, also check verification status
    if (role === 'vendor' && user.verification_status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Vendor account not approved',
        verification_status: user.verification_status
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Status verification failed'
    });
  }
};

// Optional: Middleware to check if user owns the resource
const isOwner = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    const resourceId = parseInt(req.params[resourceIdParam]);
    const userId = req.user.userId;

    if (resourceId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorize,
  verifyUserStatus,
  isOwner
};