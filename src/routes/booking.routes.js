// src/routes/booking.routes.js
const express = require('express');
const BookingController = require('../controllers/booking.controller');
const bookingValidators = require('../utils/validators/booking.validator');
const { authenticateToken, authorize, verifyUserStatus } = require('../middleware/auth.middleware');
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
  authorize('customer'),
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

module.exports = router;