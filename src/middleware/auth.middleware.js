// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { User, Vendor, AdminUser } = require('../models');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { ERROR_MESSAGES } = require('../constants');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AuthenticationError(ERROR_MESSAGES.TOKEN_REQUIRED);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError(ERROR_MESSAGES.TOKEN_EXPIRED));
    }
    return next(new AuthenticationError(ERROR_MESSAGES.TOKEN_INVALID));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError(ERROR_MESSAGES.TOKEN_REQUIRED));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError(ERROR_MESSAGES.UNAUTHORIZED));
    }

    next();
  };
};

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
        return next(new AuthorizationError('Invalid user role'));
    }

    if (!user || user.status !== 'active') {
      return next(new AuthorizationError(ERROR_MESSAGES.ACCOUNT_INACTIVE));
    }

    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateToken,
  authorize,
  verifyUserStatus
};