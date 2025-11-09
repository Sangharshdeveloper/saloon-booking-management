// middleware/authMiddleware.js - Complete Version with Backward Compatibility

const jwt = require('jsonwebtoken');
const { User, VendorShop } = require('../models');

// ============================================
// AUTHENTICATE TOKEN (Main authentication)
// ============================================
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1] || 
                  req.headers['x-access-token'] ||
                  req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Find user
    const user = await User.findByPk(decoded.user_id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Attach user to request
    req.user = {
      user_id: user.user_id,
      user_type: user.user_type,
      role: user.role,
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

// Alias for backward compatibility
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

// Alias for backward compatibility with your existing code
const authorize = authorizeUserType;

// ============================================
// AUTHORIZE BY ROLE
// ============================================
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

// ============================================
// SPECIFIC USER TYPE AUTHORIZERS
// ============================================

// Authorize admin
const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.user_type !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin access required.'
    });
  }

  next();
};

// Authorize vendor
const authorizeVendor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.user_type !== 'vendor') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Vendor access required.'
    });
  }

  next();
};

// Authorize customer
const authorizeCustomer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.user_type !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Customer access required.'
    });
  }

  next();
};

// ============================================
// VERIFY USER STATUS
// ============================================
const verifyUserStatus = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Check if user status is active
  if (req.user.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: `Account is ${req.user.status}. Please contact support.`
    });
  }

  // For vendors, also check verification status (optional)
  // You can enable this if you want to block unverified vendors
  /*
  if (req.user.user_type === 'vendor' && !req.user.is_verified) {
    return res.status(403).json({
      success: false,
      message: 'Vendor account is not verified yet. Please wait for admin approval.'
    });
  }
  */

  next();
};

// ============================================
// OPTIONAL AUTH (doesn't fail if no token)
// ============================================
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || 
                  req.headers['x-access-token'];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const user = await User.findByPk(decoded.user_id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (user && user.status === 'active') {
      req.user = {
        user_id: user.user_id,
        user_type: user.user_type,
        role: user.role,
        phone_number: user.phone_number,
        email: user.email,
        name: user.name,
        status: user.status
      };
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};

// ============================================
// VERIFY VENDOR OWNERSHIP
// ============================================
const verifyVendorOwnership = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.user_type !== 'vendor') {
      return res.status(403).json({
        success: false,
        message: 'Only vendors can access this resource'
      });
    }

    // Get vendor_id from params or body
    const vendorId = req.params.vendor_id || req.body.vendor_id;

    // Check if the authenticated user is the vendor
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
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.user_type !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only customers can access this resource'
      });
    }

    // Get user_id from params or body
    const userId = req.params.user_id || req.body.user_id;

    // Check if the authenticated user is the customer
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
  // Main authentication
  authenticate,
  authenticateToken, // Alias for backward compatibility
  
  // Authorization by user type
  authorizeUserType,
  authorize, // Alias for backward compatibility
  
  // Authorization by role
  authorizeRole,
  
  // Specific user type authorizers
  authorizeAdmin,
  authorizeVendor,
  authorizeCustomer,
  
  // Status verification
  verifyUserStatus,
  
  // Optional auth
  optionalAuth,
  
  // Ownership verification
  verifyVendorOwnership,
  verifyCustomerOwnership
};