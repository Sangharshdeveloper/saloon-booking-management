// src/utils/validators/booking.validator.js
const { body, query, param } = require('express-validator');
const { PAYMENT_METHOD, BOOKING_TYPE } = require('../../constants');

const bookingValidators = {
  createBooking: [
    body('vendor_id')
      .isInt({ min: 1 })
      .withMessage('Valid vendor ID required'),
    
    body('booking_date')
      .isDate()
      .withMessage('Valid booking date required (YYYY-MM-DD)')
      .custom((value) => {
        const bookingDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (bookingDate < today) {
          throw new Error('Booking date cannot be in the past');
        }
        return true;
      }),
    
    body('services')
      .isArray({ min: 1 })
      .withMessage('At least one service required'),
    
    body('services.*.service_id')
      .isInt({ min: 1 })
      .withMessage('Valid service ID required'),
    
    body('services.*.start_time')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time required (HH:MM format)'),
    
    // body('payment_method')
    //   .isIn(Object.values(PAYMENT_METHOD))
    //   .withMessage(`Payment method must be one of: ${Object.values(PAYMENT_METHOD).join(', ')}`),
    
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes cannot exceed 500 characters')
  ],

  createOfflineBooking: [
    body('booking_date')
      .isDate()
      .withMessage('Valid booking date required (YYYY-MM-DD)'),
    
    body('services')
      .isArray({ min: 1 })
      .withMessage('At least one service required'),
    
    body('services.*.service_id')
      .isInt({ min: 1 })
      .withMessage('Valid service ID required'),
    
    body('services.*.start_time')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time required (HH:MM format)'),
    
    body('customer_name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Customer name must be 2-100 characters'),
    
    body('customer_phone')
      .optional()
      .isMobilePhone()
      .withMessage('Valid phone number required'),
    
    // body('payment_method')
    //   .isIn(Object.values(PAYMENT_METHOD))
    //   .withMessage(`Payment method must be one of: ${Object.values(PAYMENT_METHOD).join(', ')}`),
    
    body('booking_type')
      .isIn([BOOKING_TYPE.OFFLINE, BOOKING_TYPE.WALK_IN])
      .withMessage(`Booking type must be ${BOOKING_TYPE.OFFLINE} or ${BOOKING_TYPE.WALK_IN}`),
    
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes cannot exceed 500 characters')
  ],

  getBookings: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid page number required'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    
    query('status')
      .optional()
      .isIn(['confirmed', 'cancelled', 'completed', 'no_show'])
      .withMessage('Invalid booking status'),
    
    query('date')
      .optional()
      .isDate()
      .withMessage('Valid date required (YYYY-MM-DD)')
  ],

  getSlots: [
    param('vendor_id')
      .isInt({ min: 1 })
      .withMessage('Valid vendor ID required'),
    
    query('date')
      .isDate()
      .withMessage('Valid date required (YYYY-MM-DD)')
      .custom((value) => {
        const queryDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (queryDate < today) {
          throw new Error('Date cannot be in the past');
        }
        return true;
      })
  ],

  cancelBooking: [
    param('booking_id')
      .isInt({ min: 1 })
      .withMessage('Valid booking ID required'),
    
    body('cancellation_reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Cancellation reason cannot exceed 500 characters')
  ],

  completeBooking: [
    param('booking_id')
      .isInt({ min: 1 })
      .withMessage('Valid booking ID required')
  ]
};

module.exports = bookingValidators;