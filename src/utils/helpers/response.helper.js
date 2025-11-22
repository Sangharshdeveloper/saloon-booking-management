// src/utils/helpers/response.helper.js

/**
 * Send success response (Standard)
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} status - HTTP status code
 */
function sendSuccessResponse(res, data = null, message = "Success", status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data
  });
}

/**
 * Send error response (Standard)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {*} errors - Detailed validation errors (optional)
 */
function sendErrorResponse(res, message = "Error", status = 400, errors = null) {
  const response = {
    success: false,
    message
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(status).json(response);
}

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {*} data - Data array
 * @param {Object} pagination - Pagination metadata
 * @param {string} message - Message text
 */
function sendPaginatedResponse(res, data, pagination, message = "Success") {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination
  });
}

// Export unified helpers only
module.exports = {
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedResponse
};
