// src/controllers/booking.controller.js
const BookingService = require('../services/booking.service');
const { successResponse, errorResponse } = require('../utils/helpers/response.helper');

class BookingController {
  /**
   * Create new booking
   * @route POST /api/bookings
   */
  async createBooking(req, res, next) {
    try {
      const userId = req.user.userId;
      const result = await BookingService.createBooking(userId, req.body);
      
      return successResponse(res, 'Booking created successfully', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create offline/walk-in booking (Vendor only)
   * @route POST /api/bookings/offline
   */
  async createOfflineBooking(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const result = await BookingService.createOfflineBooking(vendorId, req.body);
      
      return successResponse(res, 'Offline booking created successfully', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user bookings
   * @route GET /api/bookings/my-bookings
   */
  async getUserBookings(req, res, next) {
    try {
      const userId = req.user.userId;
      const result = await BookingService.getUserBookings(userId, req.query);
      
      return successResponse(res, 'Bookings retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendor bookings
   * @route GET /api/bookings/vendor/:vendor_id
   */
  async getVendorBookings(req, res, next) {
    try {
      const { vendor_id } = req.params;
      const userId = req.user.userId;

      // Authorization check
      if (parseInt(vendor_id) !== userId) {
        return errorResponse(res, 'Not authorized to view these bookings', 403);
      }

      const result = await BookingService.getVendorBookings(vendor_id, req.query);
      
      return successResponse(res, 'Bookings retrieved successfully', { bookings: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available slots
   * @route GET /api/bookings/slots/:vendor_id
   */
  async getAvailableSlots(req, res, next) {
    try {
      const { vendor_id } = req.params;
      const { date } = req.query;
      
      const slots = await BookingService.getAvailableSlots(vendor_id, date);
      
      return successResponse(res, 'Slots retrieved successfully', {
        vendor_id: parseInt(vendor_id),
        date,
        slots
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel booking
   * @route PUT /api/bookings/:booking_id/cancel
   */
  async cancelBooking(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { cancellation_reason } = req.body;
      const { userId, role } = req.user;

      const result = await BookingService.cancelBooking(
        booking_id, 
        userId, 
        role, 
        cancellation_reason
      );
      
      return successResponse(res, 'Booking cancelled successfully', { booking: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete booking (Vendor only)
   * @route PUT /api/bookings/:booking_id/complete
   */
  async completeBooking(req, res, next) {
    try {
      const { booking_id } = req.params;
      const vendorId = req.user.userId;

      const result = await BookingService.completeBooking(booking_id, vendorId);
      
      return successResponse(res, 'Booking marked as completed', { booking: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BookingController();