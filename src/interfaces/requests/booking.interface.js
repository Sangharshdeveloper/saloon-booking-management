// src/interfaces/requests/booking.interface.js

/**
 * @typedef {Object} CreateBookingRequest
 * @property {number} vendor_id - Vendor ID
 * @property {string} booking_date - Booking date (YYYY-MM-DD)
 * @property {Array<ServiceRequest>} services - Array of services
 * @property {string} payment_method - Payment method (cash|upi|card|wallet)
 * @property {string} [notes] - Optional booking notes
 */

/**
 * @typedef {Object} ServiceRequest
 * @property {number} service_id - Service ID
 * @property {string} start_time - Start time (HH:MM)
 */

/**
 * @typedef {Object} CreateOfflineBookingRequest
 * @property {string} booking_date - Booking date (YYYY-MM-DD)
 * @property {Array<ServiceRequest>} services - Array of services
 * @property {string} [customer_name] - Customer name for walk-in
 * @property {string} [customer_phone] - Customer phone for walk-in
 * @property {string} payment_method - Payment method
 * @property {string} booking_type - offline|walk_in
 * @property {string} [notes] - Optional notes
 */

/**
 * @typedef {Object} CancelBookingRequest
 * @property {string} [cancellation_reason] - Reason for cancellation
 */

/**
 * @typedef {Object} GetSlotsRequest
 * @property {string} date - Date for slots (YYYY-MM-DD)
 */

/**
 * @typedef {Object} GetBookingsQuery
 * @property {number} [page] - Page number
 * @property {number} [limit] - Items per page
 * @property {string} [status] - Booking status filter
 * @property {string} [date] - Date filter
 * @property {string} [date_from] - Date range start
 * @property {string} [date_to] - Date range end
 */

module.exports = {
  CreateBookingRequest: {},
  ServiceRequest: {},
  CreateOfflineBookingRequest: {},
  CancelBookingRequest: {},
  GetSlotsRequest: {},
  GetBookingsQuery: {}
};