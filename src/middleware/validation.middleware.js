// src/middleware/validation.middleware.js
const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Middleware to handle express-validator results
 */
const validationMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    throw new ValidationError('Validation failed', formattedErrors);
  }
  
  next();
};

module.exports = validationMiddleware;