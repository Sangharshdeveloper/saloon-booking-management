// src/constants/index.js
const USER_CONSTANTS = require('./user.constants');
const VENDOR_CONSTANTS = require('./vendor.constants');
const BOOKING_CONSTANTS = require('./booking.constants');
// const SERVICE_CONSTANTS = require('./service.constants');
const ERROR_CONSTANTS = require('./error.constants');
// User Types
const USER_TYPES = {
  CUSTOMER: 'customer',
  VENDOR: 'vendor',
  ADMIN: 'admin'
};

// User Status
const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated'
};

// Vendor Verification Status
const VENDOR_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Shop Status
const SHOP_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  TEMPORARILY_CLOSED: 'temporarily_closed'
};

// Booking Status
const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

// Payment Methods
const PAYMENT_METHODS = {
  CARD: 'card',
  UPI: 'upi',
  NET_BANKING: 'net_banking',
  WALLET: 'wallet',
  CASH: 'cash'
};

// Document Types
const DOCUMENT_TYPES = {
  BUSINESS_LICENSE: 'business_license',
  TAX_DOCUMENT: 'tax_document',
  ID_PROOF: 'id_proof',
  ADDRESS_PROOF: 'address_proof',
  BANK_STATEMENT: 'bank_statement'
};

// Document Verification Status
const DOCUMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Image Types
const IMAGE_TYPES = {
  SHOP: 'shop',
  SERVICE: 'service',
  GALLERY: 'gallery',
  PROFILE: 'profile'
};

// Banner Types
const BANNER_TYPES = {
  MAIN: 'main',
  PROMOTIONAL: 'promotional',
  CATEGORY: 'category',
  SEASONAL: 'seasonal'
};

// Target Entity Types for Banners
const TARGET_ENTITY_TYPES = {
  SHOP: 'shop',
  VENDOR: 'vendor',
  SERVICE: 'service',
  CATEGORY: 'category'
};

// Notification Types
const NOTIFICATION_TYPES = {
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_REMINDER: 'booking_reminder',
  BOOKING_CANCELLATION: 'booking_cancellation',
  BOOKING_COMPLETED: 'booking_completed',
  VENDOR_APPROVED: 'vendor_approved',
  VENDOR_REJECTED: 'vendor_rejected',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  PROMOTIONAL: 'promotional',
  SYSTEM: 'system'
};

// Service Categories
const SERVICE_CATEGORIES = {
  HAIRCUT: 'haircut',
  BEARD: 'beard',
  FACIAL: 'facial',
  MASSAGE: 'massage',
  HAIR_TREATMENT: 'hair_treatment',
  COLORING: 'coloring',
  SPA: 'spa',
  BRIDAL: 'bridal',
  MAKEUP: 'makeup',
  MANICURE: 'manicure',
  PEDICURE: 'pedicure',
  WAXING: 'waxing',
  THREADING: 'threading',
  OTHER: 'other'
};

// Weekly Holidays
const WEEKLY_HOLIDAYS = {
  SUNDAY: 'sunday',
  MONDAY: 'monday',
  TUESDAY: 'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday',
  FRIDAY: 'friday',
  SATURDAY: 'saturday',
  NO_HOLIDAY: 'no_holiday'
};

// Gender
const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  PREFER_NOT_TO_SAY: 'prefer_not_to_say'
};

// Dashboard Periods
const DASHBOARD_PERIODS = {
  SEVEN_DAYS: '7d',
  THIRTY_DAYS: '30d',
  NINETY_DAYS: '90d',
  ONE_YEAR: '1y'
};

// Export all constants



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
  ARCHIVE_THRESHOLD_YEARS: 2,
    USER_TYPES,
  USER_STATUS,
  VENDOR_STATUS,
  SHOP_STATUS,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  IMAGE_TYPES,
  BANNER_TYPES,
  TARGET_ENTITY_TYPES,
  NOTIFICATION_TYPES,
  SERVICE_CATEGORIES,
  WEEKLY_HOLIDAYS,
  GENDER,
  DASHBOARD_PERIODS
};