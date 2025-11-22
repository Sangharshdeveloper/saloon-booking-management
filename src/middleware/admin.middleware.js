// src/middleware/admin.middleware.js

const { sendErrorResponse } = require('../utils/helpers/response.helper');
const { USER_TYPES } = require('../constants');

/**
 * Middleware to check if the authenticated user is an admin
 */
const adminMiddleware = (req, res, next) => {
  try {
    // Check if user is authenticated (should be set by authMiddleware)
    if (!req.user) {
      return sendErrorResponse(res, 'Authentication required', 401);
    }

    // Check if user type is admin (note: property is user_type not userType)
    if (req.user.user_type !== USER_TYPES.ADMIN) {
      return sendErrorResponse(res, 'Access denied. Admin privileges required.', 403);
    }

    // User is admin, proceed to next middleware/controller
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return sendErrorResponse(res, 'Authorization failed', 500);
  }
};

module.exports = adminMiddleware;