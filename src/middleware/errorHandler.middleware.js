// src/middleware/errorHandler.middleware.js
const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  });

  // Custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error_code: err.errorCode,
      ...(err.details && { errors: err.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};



  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error_code: 'VALIDATION_ERROR',
      errors
    });
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'field';
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
      error_code: 'CONFLICT'
    });
  }

  // Sequelize foreign key constraint error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'Referenced resource not found',
      error_code: 'BAD_REQUEST'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error_code: 'AUTHENTICATION_ERROR'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error_code: 'AUTHENTICATION_ERROR'
    });
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.message,
      error_code: 'FILE_UPLOAD_ERROR'
    });
  }
}
  // // Default to 500 server error
  // res.status(error.statusCode || 500).json({
  //   success: false,
  //   message: error.message || 'Internal server error',
  //   error_code: 'INTERNAL_ERROR',
  //   ...(process.env.NODE_ENV ===module.exports = errorHandler;'development' && { stack: err.stack })
  //   });
  // }