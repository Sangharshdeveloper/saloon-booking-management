// src/interfaces/responses/common.interface.js

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Success status
 * @property {string} [message] - Response message
 * @property {*} [data] - Response data
 * @property {Array<ValidationError>} [errors] - Validation errors
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} field - Field name
 * @property {string} message - Error message
 * @property {string} [value] - Invalid value
 */

/**
 * @typedef {Object} PaginationMeta
 * @property {number} current_page - Current page number
 * @property {number} total_pages - Total pages
 * @property {number} total_count - Total items
 * @property {number} per_page - Items per page
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {boolean} success
 * @property {*} data - Response data
 * @property {PaginationMeta} pagination - Pagination metadata
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {boolean} success - Always false
 * @property {string} message - Error message
 * @property {string} [error_code] - Error code
 * @property {*} [details] - Additional error details
 * @property {string} [stack] - Stack trace (development only)
 */

module.exports = {
  ApiResponse: {},
  ValidationError: {},
  PaginationMeta: {},
  PaginatedResponse: {},
  ErrorResponse: {}
};