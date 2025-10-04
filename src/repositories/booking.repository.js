// src/repositories/booking.repository.js
const { Op } = require('sequelize');
const { 
  Booking, 
  BookingService, 
  User, 
  Vendor, 
  ServicesMaster 
} = require('../models');

class BookingRepository {
  /**
   * Create a new booking
   */
  async create(bookingData) {
    return await Booking.create(bookingData);
  }

  /**
   * Create booking services
   */
  async createBookingServices(bookingId, services) {
    const bookingServices = services.map(service => ({
      booking_id: bookingId,
      ...service
    }));
    return await BookingService.bulkCreate(bookingServices);
  }

  /**
   * Find booking by ID with associations
   */
  async findById(bookingId) {
    return await Booking.findByPk(bookingId, {
      include: [
        {
          model: User,
          attributes: ['user_id', 'name', 'phone_number']
        },
        {
          model: Vendor,
          attributes: ['vendor_id', 'shop_name', 'phone_number']
        },
        {
          model: BookingService,
          include: [ServicesMaster]
        }
      ]
    });
  }

  /**
   * Find user bookings with pagination
   */
  async findUserBookings(userId, options = {}) {
    const { page = 1, limit = 10, status } = options;
    const offset = (page - 1) * limit;

    const whereCondition = { user_id: userId };
    if (status) {
      whereCondition.booking_status = status;
    }

    const { count, rows } = await Booking.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: Vendor,
          attributes: ['vendor_id', 'shop_name', 'shop_address', 'phone_number']
        },
        {
          model: BookingService,
          include: [ServicesMaster]
        }
      ],
    });
}
}
