// src/constants/index.js
const USER_CONSTANTS = require('./user.constants');
const VENDOR_CONSTANTS = require('./vendor.constants');
const BOOKING_CONSTANTS = require('./booking.constants');
// const SERVICE_CONSTANTS = require('./service.constants');
const ERROR_CONSTANTS = require('./error.constants');

module.exports = {
  ...USER_CONSTANTS,
  ...VENDOR_CONSTANTS,
  ...BOOKING_CONSTANTS,
  // ...SERVICE_CONSTANTS,
  ...ERROR_CONSTANTS,
  
  // General constants
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  
  // Time constants
  SLOT_DURATION_MINUTES: 30,
  MIN_BOOKING_ADVANCE_HOURS: 1,
  MAX_BOOKING_ADVANCE_DAYS: 90,
  
  // File upload constants
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['jpeg', 'jpg', 'png', 'gif'],
  MAX_IMAGES_PER_UPLOAD: 10,
  
  // JWT constants
  TOKEN_EXPIRY: '7d',
  RESET_TOKEN_EXPIRY: '1h',
  
  // Archive constants
  ARCHIVE_THRESHOLD_YEARS: 2
};