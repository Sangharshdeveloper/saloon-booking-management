const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { Op } = require('sequelize');
const { 
  Booking, 
  BookingService, 
  User, 
  Vendor, 
  ServicesMaster, 
  VendorService,
  VendorHoliday,
  VendorEarlyClosure 
} = require('../models');
const { authenticateToken, authorize, verifyUserStatus } = require('../middleware/auth');

const router = express.Router();

// Helper function to check slot availability
const checkSlotAvailability = async (vendorId, bookingDate, startTime, endTime) => {
  const vendor = await Vendor.findByPk(vendorId);
  if (!vendor) throw new Error('Vendor not found');

  const maxCapacity = Math.min(vendor.no_of_seats, vendor.no_of_workers);

  // Check existing bookings for the same time slot
  const existingBookings = await BookingService.findAll({
    include: [{
      model: Booking,
      where: {
        vendor_id: vendorId,
        booking_date: bookingDate,
        booking_status: ['confirmed', 'completed']
      }
    }],
    where: {
      [Op.or]: [
        {
          start_time: { [Op.between]: [startTime, endTime] }
        },
        {
          end_time: { [Op.between]: [startTime, endTime] }
        },
        {
          [Op.and]: [
            { start_time: { [Op.lte]: startTime } },
            { end_time: { [Op.gte]: endTime } }
          ]
        }
      ]
    }
  });

  return existingBookings.length < maxCapacity;
};

// Helper function to get available time slots
const getAvailableSlots = async (vendorId, date) => {
  const vendor = await Vendor.findByPk(vendorId);
  if (!vendor) throw new Error('Vendor not found');

  // Check if date is a holiday
  const holiday = await VendorHoliday.findOne({
    where: { vendor_id: vendorId, holiday_date: date }
  });
  if (holiday) return [];

  // Check for early closure
  const earlyClosure = await VendorEarlyClosure.findOne({
    where: { vendor_id: vendorId, closure_date: date }
  });

  const openTime = vendor.open_time;
  const closeTime = earlyClosure ? earlyClosure.early_close_time : vendor.close_time;
  const breakStart = vendor.break_start_time;
  const breakEnd = vendor.break_end_time;

  const slots = [];
  const slotDuration = 30; // minutes

  // Generate time slots
  let currentTime = new Date(`2000-01-01T${openTime}`);
  const endTime = new Date(`2000-01-01T${closeTime}`);

  while (currentTime < endTime) {
    const slotStart = currentTime.toTimeString().slice(0, 5);
    currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
    const slotEnd = currentTime.toTimeString().slice(0, 5);

    // Skip break time
    if (breakStart && breakEnd) {
      const breakStartTime = new Date(`2000-01-01T${breakStart}`);
      const breakEndTime = new Date(`2000-01-01T${breakEnd}`);
      const slotStartTime = new Date(`2000-01-01T${slotStart}`);
      
      if (slotStartTime >= breakStartTime && slotStartTime < breakEndTime) {
        continue;
      }
    }

    // Check availability
    const isAvailable = await checkSlotAvailability(vendorId, date, slotStart, slotEnd);
    
    slots.push({
      start_time: slotStart,
      end_time: slotEnd,
      is_available: isAvailable
    });
  }

  return slots;
};

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private (Customer only)
router.post('/', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus,
  body('vendor_id').isInt().withMessage('Valid vendor ID required'),
  body('booking_date').isDate().withMessage('Valid booking date required'),
  body('services').isArray({ min: 1 }).withMessage('At least one service required'),
  body('services.*.service_id').isInt().withMessage('Valid service ID required'),
  body('services.*.start_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time required'),
  body('payment_method').isIn(['cash', 'upi', 'card', 'wallet']).withMessage('Valid payment method required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { vendor_id, booking_date, services, payment_method } = req.body;
    const user_id = req.user.userId;

    // Validate vendor exists and is active
    const vendor = await Vendor.findOne({
      where: { vendor_id, verification_status: 'approved', status: 'active' }
    });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or not available'
      });
    }

    // Validate services and calculate total amount
    let totalAmount = 0;
    const validatedServices = [];

    for (let service of services) {
      const vendorService = await VendorService.findOne({
        where: { 
          vendor_id, 
          service_id: service.service_id,
          is_available: true,
          status: 'active'
        },
        include: [ServicesMaster]
      });

      if (!vendorService) {
        return res.status(400).json({
          success: false,
          message: `Service ${service.service_id} not available for this vendor`
        });
      }

      // Calculate end time
      const startTime = new Date(`2000-01-01T${service.start_time}:00`);
      startTime.setMinutes(startTime.getMinutes() + vendorService.ServicesMaster.default_duration_minutes);
      const endTime = startTime.toTimeString().slice(0, 5);

      // Check slot availability
      const isAvailable = await checkSlotAvailability(
        vendor_id, 
        booking_date, 
        service.start_time, 
        endTime
      );

      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: `Time slot ${service.start_time} - ${endTime} is not available`
        });
      }

      validatedServices.push({
        service_id: service.service_id,
        service_name: vendorService.ServicesMaster.service_name,
        service_price: vendorService.price,
        start_time: service.start_time,
        end_time: endTime,
        duration_minutes: vendorService.ServicesMaster.default_duration_minutes
      });

      totalAmount += parseFloat(vendorService.price);
    }

    // Create booking
    const booking = await Booking.create({
      user_id,
      vendor_id,
      booking_date,
      total_amount: totalAmount,
      payment_method,
      payment_status: payment_method === 'cash' ? 'pending' : 'completed',
      booking_status: 'confirmed'
    });

    // Create booking services
    const bookingServices = await Promise.all(
      validatedServices.map(service => 
        BookingService.create({
          booking_id: booking.booking_id,
          service_id: service.service_id,
          service_name: service.service_name,
          service_price: service.service_price,
          start_time: service.start_time,
          end_time: service.end_time,
          duration_minutes: service.duration_minutes
        })
      )
    );

    // TODO: Send booking confirmation notification

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        booking: {
          booking_id: booking.booking_id,
          booking_date: booking.booking_date,
          total_amount: booking.total_amount,
          payment_method: booking.payment_method,
          booking_status: booking.booking_status,
          services: bookingServices
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/bookings/slots/:vendor_id
// @desc    Get available time slots for a vendor on a specific date
// @access  Public
router.get('/slots/:vendor_id', [
  query('date').isDate().withMessage('Valid date required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { vendor_id } = req.params;
    const { date } = req.query;

    const slots = await getAvailableSlots(vendor_id, date);

    res.json({
      success: true,
      data: {
        vendor_id: parseInt(vendor_id),
        date,
        slots
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/bookings/my-bookings
// @desc    Get user's booking history
// @access  Private (Customer only)
router.get('/my-bookings', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus,
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page number required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Valid limit required'),
  query('status').optional().isIn(['confirmed', 'cancelled', 'completed']).withMessage('Valid status required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const user_id = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const whereCondition = { user_id };
    if (status) {
      whereCondition.booking_status = status;
    }

    const { count, rows: bookings } = await Booking.findAndCountAll({
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
      order: [['booking_date', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_count: count,
          per_page: limit
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/bookings/:booking_id/cancel
// @desc    Cancel a booking
// @access  Private (Customer or Vendor)
router.put('/:booking_id/cancel', [
  authenticateToken,
  authorize('customer', 'vendor'),
  verifyUserStatus,
  body('cancellation_reason').optional().isLength({ max: 500 }).withMessage('Cancellation reason too long')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { booking_id } = req.params;
    const { cancellation_reason } = req.body;
    const { userId, role } = req.user;

    // Find booking
    const booking = await Booking.findByPk(booking_id, {
      include: [
        { model: User },
        { model: Vendor },
        { model: BookingService }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    if (role === 'customer' && booking.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    if (role === 'vendor' && booking.vendor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Check if booking can be cancelled
    if (booking.booking_status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking already cancelled'
      });
    }

    if (booking.booking_status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed booking'
      });
    }

    // Check time constraint (1 hour before booking)
    const now = new Date();
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.BookingServices[0].start_time}`);
    const timeDiff = bookingDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking less than 1 hour before appointment time'
      });
    }

    // Update booking
    await booking.update({
      booking_status: 'cancelled',
      cancellation_reason,
      cancelled_by: role
    });

    // TODO: Send cancellation notification to both user and vendor

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: { booking }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/bookings/vendor/:vendor_id
// @desc    Get vendor's bookings
// @access  Private (Vendor only)
router.get('/vendor/:vendor_id', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  query('date').optional().isDate().withMessage('Valid date required'),
  query('status').optional().isIn(['confirmed', 'cancelled', 'completed']).withMessage('Valid status required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { vendor_id } = req.params;
    const { date, status } = req.query;
    const userId = req.user.userId;

    // Check authorization
    if (parseInt(vendor_id) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these bookings'
      });
    }

    const whereCondition = { vendor_id };
    if (date) {
      whereCondition.booking_date = date;
    }
    if (status) {
      whereCondition.booking_status = status;
    }

    const bookings = await Booking.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          attributes: ['user_id', 'name', 'phone_number']
        },
        {
          model: BookingService,
          include: [ServicesMaster]
        }
      ],
      order: [
        ['booking_date', 'ASC'],
        [BookingService, 'start_time', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: { bookings }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/bookings/:booking_id/complete
// @desc    Mark booking as completed
// @access  Private (Vendor only)
router.put('/:booking_id/complete', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const { booking_id } = req.params;
    const userId = req.user.userId;

    const booking = await Booking.findByPk(booking_id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    if (booking.vendor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this booking'
      });
    }

    if (booking.booking_status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be completed'
      });
    }

    await booking.update({
      booking_status: 'completed'
    });

    // TODO: Send review request notification after 24 hours

    res.json({
      success: true,
      message: 'Booking marked as completed',
      data: { booking }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;