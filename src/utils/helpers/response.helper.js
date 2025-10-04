// src/utils/helpers/response.helper.js

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {*} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const successResponse = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {*} errors - Validation errors or additional details
 */
const errorResponse = (res, message, statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {Array} data - Data array
 * @param {Object} pagination - Pagination metadata
 */
const paginatedResponse = (res, message, data, pagination) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse
};