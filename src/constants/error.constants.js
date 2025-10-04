// src/constants/error.constants.js
module.exports = {
  ERROR_MESSAGES: {
    // Authentication
    TOKEN_REQUIRED: 'Access token required',
    TOKEN_EXPIRED: 'Token expired',
    TOKEN_INVALID: 'Invalid token',
    UNAUTHORIZED: 'Access denied. Insufficient permissions.',
    ACCOUNT_INACTIVE: 'Account inactive or not found',
    INVALID_CREDENTIALS: 'Invalid credentials',
    
    // User
    USER_EXISTS: 'User already exists with this phone number',
    USER_NOT_FOUND: 'User not found',
    
    // Vendor
    VENDOR_EXISTS: 'Vendor already exists with this phone number',
    VENDOR_NOT_FOUND: 'Vendor not found',
    VENDOR_NOT_APPROVED: 'Vendor not approved',
    VENDOR_HAS_BOOKINGS: 'Cannot perform action with existing bookings',
    
    // Booking
    BOOKING_NOT_FOUND: 'Booking not found',
    SLOT_NOT_AVAILABLE: 'Time slot not available',
    BOOKING_ALREADY_CANCELLED: 'Booking already cancelled',
    BOOKING_COMPLETED: 'Cannot modify completed booking',
    CANCELLATION_DEADLINE: 'Cannot cancel booking less than 1 hour before appointment',
    
    // Service
    SERVICE_EXISTS: 'Service with this name already exists',
    SERVICE_NOT_FOUND: 'Service not found',
    SERVICE_IN_USE: 'Service is currently in use',
    
    // Review
    REVIEW_EXISTS: 'Review already exists for this booking',
    REVIEW_NOT_ELIGIBLE: 'Only completed bookings can be reviewed',
    
    // Validation
    VALIDATION_FAILED: 'Validation failed',
    INVALID_INPUT: 'Invalid input provided',
    
    // General
    RESOURCE_NOT_FOUND: 'Resource not found',
    INTERNAL_ERROR: 'Internal server error',
    OPERATION_FAILED: 'Operation failed'
  },
  
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    BAD_REQUEST: 'BAD_REQUEST'
  }
};