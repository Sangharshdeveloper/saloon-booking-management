// src/services/booking.service.js
const { Op } = require('sequelize');
const BookingRepository = require('../repositories/booking.repository');
const VendorRepository = require('../repositories/vendor.repository');
const ServiceRepository = require('../repositories/service.repository');
const SlotService = require('./slot.service');
const { 
  BOOKING_STATUS, 
  PAYMENT_STATUS, 
  MIN_CANCELLATION_HOURS,
  BOOKING_TYPE
} = require('../constants');
const { 
  NotFoundError, 
  ValidationError,
  ConflictError 
} = require('../utils/errors');

class BookingService {
  /**
   * Create a new booking
   * @param {number} userId - User ID
   * @param {CreateBookingRequest} bookingData - Booking details
   * @returns {Promise<Object>} Created booking
   */
  async createBooking(userId, bookingData) {
    const { vendor_id, booking_date, services, payment_method, notes } = bookingData;

    // Validate vendor
    const vendor = await VendorRepository.findActiveVendor(vendor_id);
    if (!vendor) {
      throw new NotFoundError('Vendor not found or not available');
    }

    // Validate and process services
    const validatedServices = await this._validateServices(vendor_id, services, booking_date);

    // Calculate total amount
    const totalAmount = validatedServices.reduce(
      (sum, service) => sum + parseFloat(service.service_price), 
      0
    );

    // Create booking
    const booking = await BookingRepository.create({
      user_id: userId,
      vendor_id,
      booking_date,
      total_amount: totalAmount,
      payment_method,
      payment_status: payment_method === 'cash' ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.COMPLETED,
      booking_status: BOOKING_STATUS.CONFIRMED,
      booking_type: BOOKING_TYPE.ONLINE,
      notes
    });

    // Create booking services
    const bookingServices = await BookingRepository.createBookingServices(
      booking.booking_id,
      validatedServices
    );

    return {
      booking,
      services: bookingServices
    };
  }

  /**
   * Create offline/walk-in booking (Vendor only)
   * @param {number} vendorId - Vendor ID
   * @param {CreateOfflineBookingRequest} bookingData - Booking details
   * @returns {Promise<Object>} Created booking
   */
  async createOfflineBooking(vendorId, bookingData) {
    const { 
      booking_date, 
      services, 
      customer_name, 
      customer_phone,
      payment_method,
      booking_type,
      notes 
    } = bookingData;

    // Validate services
    const validatedServices = await this._validateServices(vendorId, services, booking_date);

    // Calculate total amount
    const totalAmount = validatedServices.reduce(
      (sum, service) => sum + parseFloat(service.service_price), 
      0
    );

    // Create booking without user_id for walk-in customers
    const booking = await BookingRepository.create({
      vendor_id: vendorId,
      user_id: null, // Walk-in booking
      booking_date,
      total_amount: totalAmount,
      payment_method,
      payment_status: PAYMENT_STATUS.COMPLETED, // Offline bookings are paid immediately
      booking_status: BOOKING_STATUS.CONFIRMED,
      booking_type: booking_type || BOOKING_TYPE.OFFLINE,
      notes: notes || `Walk-in customer: ${customer_name || 'N/A'}, Phone: ${customer_phone || 'N/A'}`
    });

    // Create booking services
    const bookingServices = await BookingRepository.createBookingServices(
      booking.booking_id,
      validatedServices
    );

    return {
      booking,
      services: bookingServices
    };
  }

  /**
   * Get user bookings with pagination
   */
  async getUserBookings(userId, query) {
    const { page = 1, limit = 10, status } = query;
    return await BookingRepository.findUserBookings(userId, { page, limit, status });
  }

  /**
   * Get vendor bookings
   */
  async getVendorBookings(vendorId, query) {
    const { date, status } = query;
    return await BookingRepository.findVendorBookings(vendorId, { date, status });
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId, userId, role, cancellationReason) {
    const booking = await BookingRepository.findById(bookingId);
    
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Authorization check
    if (role === 'customer' && booking.user_id !== userId) {
      throw new ValidationError('Not authorized to cancel this booking');
    }
    if (role === 'vendor' && booking.vendor_id !== userId) {
      throw new ValidationError('Not authorized to cancel this booking');
    }

    // Status checks
    if (booking.booking_status === BOOKING_STATUS.CANCELLED) {
      throw new ConflictError('Booking already cancelled');
    }
    if (booking.booking_status === BOOKING_STATUS.COMPLETED) {
      throw new ValidationError('Cannot cancel completed booking');
    }

    // Time check
    const bookingServices = await BookingRepository.getBookingServices(bookingId);
    const firstService = bookingServices[0];
    const bookingDateTime = new Date(`${booking.booking_date}T${firstService.start_time}`);
    const now = new Date();
    const hoursDiff = (bookingDateTime - now) / (1000 * 60 * 60);

    if (hoursDiff < MIN_CANCELLATION_HOURS) {
      throw new ValidationError(`Cannot cancel booking less than ${MIN_CANCELLATION_HOURS} hour before appointment`);
    }

    // Update booking
    return await BookingRepository.cancel(bookingId, cancellationReason, role);
  }

  /**
   * Complete booking (Vendor only)
   */
  async completeBooking(bookingId, vendorId) {
    const booking = await BookingRepository.findById(bookingId);
    
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.vendor_id !== vendorId) {
      throw new ValidationError('Not authorized to complete this booking');
    }

    if (booking.booking_status !== BOOKING_STATUS.CONFIRMED) {
      throw new ValidationError('Only confirmed bookings can be completed');
    }

    return await BookingRepository.updateStatus(bookingId, BOOKING_STATUS.COMPLETED);
  }

  /**
   * Get available slots
   */
  async getAvailableSlots(vendorId, date) {
    return await SlotService.getAvailableSlots(vendorId, date);
  }

  /**
   * Private helper to validate services
   */
  async _validateServices(vendorId, services, bookingDate) {
    const validatedServices = [];

    for (const service of services) {
      const vendorService = await ServiceRepository.findVendorService(
        vendorId, 
        service.service_id
      );

      if (!vendorService) {
        throw new ValidationError(`Service ${service.service_id} not available`);
      }

      // Calculate end time
      const startTime = new Date(`2000-01-01T${service.start_time}:00`);
      startTime.setMinutes(
        startTime.getMinutes() + vendorService.ServicesMaster.default_duration_minutes
      );
      const endTime = startTime.toTimeString().slice(0, 5);

      // Check slot availability
      const isAvailable = await SlotService.checkSlotAvailability(
        vendorId,
        bookingDate,
        service.start_time,
        endTime
      );

      if (!isAvailable) {
        throw new ConflictError(
          `Time slot ${service.start_time} - ${endTime} is not available`
        );
      }

      validatedServices.push({
        service_id: service.service_id,
        service_name: vendorService.ServicesMaster.service_name,
        service_price: vendorService.price,
        start_time: service.start_time,
        end_time: endTime,
        duration_minutes: vendorService.ServicesMaster.default_duration_minutes
      });
    }

    return validatedServices;
  }
}

module.exports = new BookingService();