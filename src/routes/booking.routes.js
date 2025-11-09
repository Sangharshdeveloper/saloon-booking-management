// src/routes/booking.routes.js
const express = require('express');
const BookingController = require('../controllers/booking.controller');
const bookingValidators = require('../utils/validators/booking.validator');
const { authenticateToken, authorize, verifyUserStatus } = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

// Public routes
router.get(
  '/slots/:vendor_id',
  bookingValidators.getSlots,
  validationMiddleware,
  BookingController.getAvailableSlots
);

// Customer routes
router.post(
  '/',
  authenticateToken,
  authorize('customer'),
  verifyUserStatus,
  bookingValidators.createBooking,
  validationMiddleware,
  BookingController.createBooking
);

router.get(
  '/my-bookings',
  authenticateToken,
  // authorize('customer'),
  verifyUserStatus,
  bookingValidators.getBookings,
  validationMiddleware,
  BookingController.getUserBookings
);

// Vendor routes
router.post(
  '/offline',
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  bookingValidators.createOfflineBooking,
  validationMiddleware,
  BookingController.createOfflineBooking
);

router.get(
  '/vendor/:vendor_id',
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  bookingValidators.getBookings,
  validationMiddleware,
  BookingController.getVendorBookings
);

router.put(
  '/:booking_id/complete',
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  bookingValidators.completeBooking,
  validationMiddleware,
  BookingController.completeBooking
);

// Both customer and vendor can cancel
router.put(
  '/:booking_id/cancel',
  authenticateToken,
  authorize('customer', 'vendor'),
  verifyUserStatus,
  bookingValidators.cancelBooking,
  validationMiddleware,
  BookingController.cancelBooking
);

// @route   POST /api/bookings/offline
// @desc    Create offline booking (vendor for walk-in customers)
// @access  Private (Vendor only)
// router.post('/offline', [
//   authenticateToken,
//   authorize('vendor'),
//   verifyUserStatus,
//   body('booking_date').isDate().withMessage('Valid booking date required'),
//   body('booking_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid booking time required (HH:MM)'),
//   body('service_ids').isArray({ min: 1 }).withMessage('At least one service is required'),
//   body('customer_name').notEmpty().isLength({ min: 2 }).withMessage('Customer name is required'),
//   body('customer_phone').matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number required'),
//   body('notes').optional().isLength({ max: 500 }).withMessage('Notes too long'),
//   validate
// ], BookingController.createOfflineBooking);

module.exports = router;