// src/constants/booking.constants.js
module.exports = {
  BOOKING_STATUS: {
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    NO_SHOW: 'no_show'
  },
  
  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },
  
  PAYMENT_METHOD: {
    CASH: 'cash',
    UPI: 'upi',
    CARD: 'card',
    WALLET: 'wallet'
  },
  
  CANCELLED_BY: {
    USER: 'user',
    VENDOR: 'vendor',
    ADMIN: 'admin'
  },
  
  BOOKING_TYPE: {
    ONLINE: 'online',
    OFFLINE: 'offline',
    WALK_IN: 'walk_in'
  },
  
  MIN_CANCELLATION_HOURS: 1,
  REVIEW_ELIGIBILITY_DAYS: 30
};