const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { User, Booking, BookingService, Vendor, Review, ServicesMaster } = require('../models');
const { authenticateToken, authorize, verifyUserStatus } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private (Customer only)
router.get('/profile', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const user_id = req.user.userId;

    const user = await User.findByPk(user_id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private (Customer only)
router.put('/profile', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus,
  body('name').optional().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('city').optional().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  body('state').optional().isLength({ min: 2 }).withMessage('State must be at least 2 characters'),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Valid gender required')
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
    const updateData = { ...req.body };

    // Remove fields that cannot be updated
    delete updateData.phone_number;
    delete updateData.password;

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update(updateData);

    const updatedUser = await User.findByPk(user_id, {
      attributes: { exclude: ['password_hash'] }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private (Customer only)
router.put('/change-password', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus,
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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
    const { current_password, new_password } = req.body;

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 12);

    await user.update({
      password_hash: hashedNewPassword
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/users/reviews
// @desc    Add review for completed booking
// @access  Private (Customer only)
router.post('/reviews', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus,
  body('booking_id').isInt().withMessage('Valid booking ID required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1-5'),
  body('review_text').optional().isLength({ max: 1000 }).withMessage('Review text too long')
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
    const { booking_id, rating, review_text } = req.body;

    // Verify booking exists and belongs to user
    const booking = await Booking.findOne({
      where: {
        booking_id,
        user_id,
        booking_status: 'completed'
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Completed booking not found'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      where: { booking_id, user_id }
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'Review already exists for this booking'
      });
    }

    const review = await Review.create({
      booking_id,
      user_id,
      vendor_id: booking.vendor_id,
      rating,
      review_text
    });

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: { review }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/reviews
// @desc    Get user's reviews
// @access  Private (Customer only)
router.get('/reviews', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const user_id = req.user.userId;

    const reviews = await Review.findAll({
      where: { user_id },
      include: [
        {
          model: Vendor,
          attributes: ['vendor_id', 'shop_name', 'shop_address']
        },
        {
          model: Booking,
          attributes: ['booking_id', 'booking_date']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: { reviews }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/favorites
// @desc    Get user's favorite vendors (based on bookings/reviews)
// @access  Private (Customer only)
router.get('/favorites', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const user_id = req.user.userId;

    // Get vendors where user has multiple bookings or high ratings
    const favoriteVendors = await Vendor.findAll({
      include: [
        {
          model: Booking,
          where: { user_id, booking_status: 'completed' },
          attributes: ['booking_id', 'booking_date'],
          required: true
        },
        {
          model: Review,
          where: { user_id, rating: { [Op.gte]: 4 } },
          attributes: ['rating', 'review_text'],
          required: false
        }
      ],
      attributes: [
        'vendor_id', 
        'shop_name', 
        'shop_address', 
        'city',
        [sequelize.fn('COUNT', sequelize.col('Bookings.booking_id')), 'booking_count']
      ],
      group: ['Vendor.vendor_id', 'Reviews.review_id'],
      having: sequelize.literal('COUNT("Bookings"."booking_id") >= 2'),
      order: [[sequelize.fn('COUNT', sequelize.col('Bookings.booking_id')), 'DESC']]
    });

    res.json({
      success: true,
      data: { favorites: favoriteVendors }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/dashboard
// @desc    Get user dashboard data
// @access  Private (Customer only)
router.get('/dashboard', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const user_id = req.user.userId;
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get user statistics
    const [
      totalBookings,
      upcomingBookings,
      completedBookings,
      pendingReviews,
      monthlySpending
    ] = await Promise.all([
      Booking.count({ where: { user_id } }),
      Booking.count({
        where: {
          user_id,
          booking_status: 'confirmed',
          booking_date: { [Op.gte]: today.toISOString().split('T')[0] }
        }
      }),
      Booking.count({
        where: {
          user_id,
          booking_status: 'completed'
        }
      }),
      Booking.count({
        where: {
          user_id,
          booking_status: 'completed'
        },
        include: [{
          model: Review,
          where: { user_id },
          required: false
        }],
        having: sequelize.literal('COUNT("Reviews"."review_id") = 0')
      }),
      Booking.sum('total_amount', {
        where: {
          user_id,
          booking_status: 'completed',
          created_at: { [Op.gte]: thirtyDaysAgo }
        }
      })
    ]);

    // Get recent bookings
    const recentBookings = await Booking.findAll({
      where: { user_id },
      include: [
        {
          model: Vendor,
          attributes: ['vendor_id', 'shop_name', 'shop_address']
        },
        {
          model: BookingService,
          include: [ServicesMaster]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    // Get favorite services (most booked)
    const favoriteServices = await BookingService.findAll({
      include: [{
        model: Booking,
        where: { 
          user_id,
          booking_status: 'completed'
        }
      }, {
        model: ServicesMaster,
        attributes: ['service_name']
      }],
      attributes: [
        'service_id',
        [sequelize.fn('COUNT', sequelize.col('BookingService.booking_service_id')), 'booking_count']
      ],
      group: ['service_id', 'ServicesMaster.service_id', 'ServicesMaster.service_name'],
      order: [[sequelize.fn('COUNT', sequelize.col('BookingService.booking_service_id')), 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        stats: {
          total_bookings: totalBookings,
          upcoming_bookings: upcomingBookings,
          completed_bookings: completedBookings,
          pending_reviews: pendingReviews,
          monthly_spending: monthlySpending || 0
        },
        recent_bookings: recentBookings,
        favorite_services: favoriteServices
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account (soft delete)
// @access  Private (Customer only)
router.delete('/account', [
  authenticateToken,
  authorize('customer'),
  verifyUserStatus,
  body('password').notEmpty().withMessage('Password confirmation required'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason too long')
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
    const { password } = req.body;

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Check for upcoming bookings
    const upcomingBookings = await Booking.count({
      where: {
        user_id,
        booking_status: 'confirmed',
        booking_date: { [Op.gte]: new Date().toISOString().split('T')[0] }
      }
    });

    if (upcomingBookings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete account with ${upcomingBookings} upcoming bookings. Please cancel them first.`
      });
    }

    // Soft delete user account
    await user.update({
      status: 'deleted',
      phone_number: `deleted_${user_id}_${user.phone_number}` // Prevent unique constraint issues
    });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;