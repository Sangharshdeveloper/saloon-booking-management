// middleware/authMiddleware.js - Clean Version (No role anywhere)

const jwt = require('jsonwebtoken');
const { User, VendorShop } = require('../models');

// ============================================
// AUTHENTICATE TOKEN (Main authentication)
// ============================================
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || 
                  req.headers['x-access-token'] ||
                  req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const user = await User.findByPk(decoded.user_id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    req.user = {
      user_id: user.user_id,
      user_type: user.user_type,
      phone_number: user.phone_number,
      email: user.email,
      name: user.name,
      status: user.status
    };

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

    console.error('Authentication error:', error);

    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

const authenticateToken = authenticate;

// ============================================
// AUTHORIZE BY USER TYPE
// ============================================
const authorizeUserType = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedTypes.includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required user type: ${allowedTypes.join(' or ')}`
      });
    }

    next();
  };
};

const authorize = authorizeUserType;

// ============================================
// AUTHORIZE BY ROLE (No DB role field → remove logic)
// ============================================
const authorizeRole = () => {
  return (req, res, next) => {
    return res.status(400).json({
      success: false,
      message: 'Role-based authorization is disabled (role column does not exist).'
    });
  };
};

// ============================================
// SPECIFIC USER TYPE AUTHORIZERS
// ============================================
const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.user.user_type !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin access required.' });
  }

  next();
};

const authorizeVendor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.user.user_type !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Access denied. Vendor access required.' });
  }

  next();
};

const authorizeCustomer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.user.user_type !== 'customer') {
    return res.status(403).json({ success: false, message: 'Access denied. Customer access required.' });
  }

  next();
};

// ============================================
// VERIFY USER STATUS
// ============================================
const verifyUserStatus = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.user.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: `Account is ${req.user.status}. Please contact support.`
    });
  }

  next();
};

// ============================================
// OPTIONAL AUTH
// ============================================
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || 
                  req.headers['x-access-token'];

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const user = await User.findByPk(decoded.user_id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (user && user.status === 'active') {
      req.user = {
        user_id: user.user_id,
        user_type: user.user_type,
        phone_number: user.phone_number,
        email: user.email,
        name: user.name,
        status: user.status
      };
    }

    next();
  } catch (error) {
    next();
  }
};

// ============================================
// VERIFY VENDOR OWNERSHIP
// ============================================
const verifyVendorOwnership = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user.user_type !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Only vendors can access this resource' });
    }

    const vendorId = req.params.vendor_id || req.body.vendor_id;

    if (parseInt(vendorId) !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own vendor resources'
      });
    }

    next();
  } catch (error) {
    console.error('Verify vendor ownership error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization failed',
      error: error.message
    });
  }
};

// ============================================
// VERIFY CUSTOMER OWNERSHIP
// ============================================
const verifyCustomerOwnership = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user.user_type !== 'customer') {
      return res.status(403).json({ success: false, message: 'Only customers can access this resource' });
    }

    const userId = req.params.user_id || req.body.user_id;

    if (parseInt(userId) !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own resources'
      });
    }

    next();
  } catch (error) {
    console.error('Verify customer ownership error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization failed',
      error: error.message
    });
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  authenticate,
  authenticateToken,
  authorizeUserType,
  authorize,
  authorizeRole, // still exported but harmless
  authorizeAdmin,
  authorizeVendor,
  authorizeCustomer,
  verifyUserStatus,
  optionalAuth,
  verifyVendorOwnership,
  verifyCustomerOwnership
};
