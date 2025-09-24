const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database'); // <-- add this line

const { 
  AdminUser, 
  Vendor, 
  User, 
  Booking, 
  Review, 
  VerificationDocument,
  ServicesMaster,
  VendorService,
  BookingService,
  Notification
} = require('../models');
const { authenticateToken, authorize, verifyUserStatus } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const limit = 5;
    const offset = 0;
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get basic statistics
    const [
      totalUsers,
      totalVendors,
      activeVendors,
      pendingApprovals,
      totalBookings,
      completedBookings,
      monthlyBookings,
      monthlyRevenue,
      totalReviews,
      averageRating
    ] = await Promise.all([
      User.count({ where: { status: 'active' } }),
      Vendor.count(),
      Vendor.count({ where: { verification_status: 'approved', status: 'active' } }),
      Vendor.count({ where: { verification_status: 'pending', status: 'active' } }),
      Booking.count(),
      Booking.count({ where: { booking_status: 'completed' } }),
      Booking.count({ 
        where: { 
          created_at: { [Op.gte]: startOfMonth },
          booking_status: { [Op.in]: ['confirmed', 'completed'] }
        }
      }),
      Booking.sum('total_amount', {
        where: {
          booking_status: 'completed',
          created_at: { [Op.gte]: startOfMonth }
        }
      }),
      Review.count(),
      Review.findOne({
        attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating']]
      })
    ]);

    // Get recent activity (last 10 activities)
    const recentBookings = await Booking.findAll({
      include: [
        { model: User, attributes: ['name'] },
        { model: Vendor, attributes: ['shop_name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['booking_id', 'booking_status', 'total_amount', 'created_at']
    });

    const recentVendorRegistrations = await Vendor.findAll({
      where: { verification_status: 'pending' },
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['vendor_id', 'owner_name', 'shop_name', 'city', 'created_at']
    });

    // Monthly trends (last 6 months)
    const monthlyStats = await Promise.all([
      // Bookings trend
      sequelize.query(`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as booking_count,
          SUM(CASE WHEN booking_status = 'completed' THEN total_amount ELSE 0 END) as revenue
        FROM bookings 
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
      `, { type: sequelize.QueryTypes.SELECT }),
      
      // User registration trend
      sequelize.query(`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as user_count
        FROM users 
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
      `, { type: sequelize.QueryTypes.SELECT })
    ]);

    // Top performing vendors
    const topVendors = await Vendor.findAll({
      include: [
        {
          model: Booking,
          where: { booking_status: 'completed' },
          required: false
        },
        {
          model: Review,
          required: false
        }
      ],
      where: { verification_status: 'approved', status: 'active' },
      attributes: [
        'vendor_id',
        'shop_name',
        'city',
        [sequelize.fn('COUNT', sequelize.col('Bookings.booking_id')), 'total_bookings'],
        [sequelize.fn('COUNT', sequelize.col('Reviews.review_id')), 'total_reviews']
      ],
      group: ['User.user_id'],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_count: count,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/bookings
// @desc    Get all bookings with filtering
// @access  Private (Admin only)
router.get('/bookings', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page number required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Valid limit required'),
  query('booking_status').optional().isIn(['confirmed', 'cancelled', 'completed']).withMessage('Valid booking status required'),
  query('date_from').optional().isDate().withMessage('Valid from date required'),
  query('date_to').optional().isDate().withMessage('Valid to date required')
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

    const {
      page = 1,
      limit = 10,
      booking_status,
      date_from,
      date_to
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where conditions
    let whereConditions = {};

    if (booking_status) {
      whereConditions.booking_status = booking_status;
    }

    if (date_from || date_to) {
      whereConditions.booking_date = {};
      if (date_from) {
        whereConditions.booking_date[Op.gte] = date_from;
      }
      if (date_to) {
        whereConditions.booking_date[Op.lte] = date_to;
      }
    }

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          attributes: ['user_id', 'name', 'phone_number']
        },
        {
          model: Vendor,
          attributes: ['vendor_id', 'shop_name', 'city']
        },
        {
          model: BookingService,
          include: [ServicesMaster]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_count: count,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/reviews
// @desc    Get all reviews with filtering
// @access  Private (Admin only)
router.get('/reviews', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page number required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Valid limit required'),
  query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Valid rating required'),
  query('vendor_id').optional().isInt().withMessage('Valid vendor ID required')
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

    const {
      page = 1,
      limit = 10,
      rating,
      vendor_id
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where conditions
    let whereConditions = {};

    if (rating) {
      whereConditions.rating = parseInt(rating);
    }

    if (vendor_id) {
      whereConditions.vendor_id = parseInt(vendor_id);
    }

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          attributes: ['user_id', 'name']
        },
        {
          model: Vendor,
          attributes: ['vendor_id', 'shop_name', 'city']
        },
        {
          model: Booking,
          attributes: ['booking_id', 'booking_date']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_count: count,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/admin/create-admin
// @desc    Create new admin user (Super Admin only)
// @access  Private (Admin only)
router.post('/create-admin', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').optional().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('role').optional().isIn(['admin', 'super_admin']).withMessage('Valid role required')
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

    const { username, email, password, full_name, role = 'admin' } = req.body;

    // Check if admin already exists
    const existingAdmin = await AdminUser.findOne({
      where: {
        [Op.or]: [
          { username: username.trim() },
          { email }
        ]
      }
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Admin with this username or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await AdminUser.create({
      username: username.trim(),
      email,
      password_hash: hashedPassword,
      full_name,
      role,
      status: 'active'
    });

    // Remove password from response
    const { password_hash, ...adminData } = admin.toJSON();

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: { admin: adminData }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/reports/revenue
// @desc    Get revenue reports
// @access  Private (Admin only)
router.get('/reports/revenue', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Valid period required'),
  query('date_from').optional().isDate().withMessage('Valid from date required'),
  query('date_to').optional().isDate().withMessage('Valid to date required')
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

    const {
      period = 'monthly',
      date_from,
      date_to
    } = req.query;

    let dateFormat;
    let groupBy;

    switch (period) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD';
        groupBy = 'DATE(created_at)';
        break;
      case 'weekly':
        dateFormat = 'YYYY-"W"WW';
        groupBy = 'DATE_TRUNC(\'week\', created_at)';
        break;
      case 'monthly':
        dateFormat = 'YYYY-MM';
        groupBy = 'DATE_TRUNC(\'month\', created_at)';
        break;
      case 'yearly':
        dateFormat = 'YYYY';
        groupBy = 'DATE_TRUNC(\'year\', created_at)';
        break;
    }

    let whereClause = `WHERE booking_status = 'completed'`;
    
    if (date_from) {
      whereClause += ` AND created_at >= '${date_from}'`;
    }
    
    if (date_to) {
      whereClause += ` AND created_at <= '${date_to}'`;
    }

    const revenueData = await sequelize.query(`
      SELECT 
        ${groupBy} as period,
        COUNT(*) as total_bookings,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_booking_value
      FROM bookings 
      ${whereClause}
      GROUP BY ${groupBy}
      ORDER BY period DESC
      LIMIT 12
    `, { type: sequelize.QueryTypes.SELECT });

    // Get top performing services by revenue
    const topServices = await sequelize.query(`
      SELECT 
        sm.service_name,
        COUNT(bs.booking_service_id) as booking_count,
        SUM(bs.service_price) as total_revenue
      FROM booking_services bs
      JOIN services_master sm ON bs.service_id = sm.service_id
      JOIN bookings b ON bs.booking_id = b.booking_id
      WHERE b.booking_status = 'completed'
      ${date_from ? `AND b.created_at >= '${date_from}'` : ''}
      ${date_to ? `AND b.created_at <= '${date_to}'` : ''}
      GROUP BY sm.service_id, sm.service_name
      ORDER BY total_revenue DESC
      LIMIT 10
    `, { type: sequelize.QueryTypes.SELECT });

    res.json({
      success: true,
      data: {
        period,
        revenue_trend: revenueData,
        top_services: topServices,
        summary: {
          total_revenue: revenueData.reduce((sum, item) => sum + parseFloat(item.total_revenue || 0), 0),
          total_bookings: revenueData.reduce((sum, item) => sum + parseInt(item.total_bookings || 0), 0),
          average_booking_value: revenueData.length > 0 
            ? revenueData.reduce((sum, item) => sum + parseFloat(item.average_booking_value || 0), 0) / revenueData.length 
            : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/analytics/vendors
// @desc    Get vendor analytics
// @access  Private (Admin only)
router.get('/analytics/vendors', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    // Vendor distribution by city
    const vendorsByCity = await Vendor.findAll({
      where: { verification_status: 'approved', status: 'active' },
      attributes: [
        'city',
        [sequelize.fn('COUNT', sequelize.col('vendor_id')), 'vendor_count']
      ],
      group: ['city'],
      order: [[sequelize.fn('COUNT', sequelize.col('vendor_id')), 'DESC']],
      limit: 10
    });

    // Vendor performance metrics
    const vendorPerformance = await sequelize.query(`
      SELECT 
        v.vendor_id,
        v.shop_name,
        v.city,
        COUNT(DISTINCT b.booking_id) as total_bookings,
        COUNT(DISTINCT CASE WHEN b.booking_status = 'completed' THEN b.booking_id END) as completed_bookings,
        COUNT(DISTINCT CASE WHEN b.booking_status = 'cancelled' THEN b.booking_id END) as cancelled_bookings,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(DISTINCT r.review_id) as total_reviews,
        COALESCE(SUM(CASE WHEN b.booking_status = 'completed' THEN b.total_amount END), 0) as total_revenue
      FROM vendors v
      LEFT JOIN bookings b ON v.vendor_id = b.vendor_id
      LEFT JOIN reviews r ON v.vendor_id = r.vendor_id
      WHERE v.verification_status = 'approved' AND v.status = 'active'
      GROUP BY v.vendor_id, v.shop_name, v.city
      HAVING COUNT(DISTINCT b.booking_id) > 0
      ORDER BY total_revenue DESC
      LIMIT 20
    `, { type: sequelize.QueryTypes.SELECT });

    // Service popularity across vendors
    const servicePopularity = await sequelize.query(`
      SELECT 
        sm.service_name,
        COUNT(DISTINCT vs.vendor_id) as vendors_offering,
        COUNT(bs.booking_service_id) as total_bookings,
        AVG(vs.price) as average_price
      FROM services_master sm
      LEFT JOIN vendor_services vs ON sm.service_id = vs.service_id
      LEFT JOIN booking_services bs ON sm.service_id = bs.service_id
      WHERE vs.status = 'active' AND vs.is_available = true
      GROUP BY sm.service_id, sm.service_name
      ORDER BY total_bookings DESC
    `, { type: sequelize.QueryTypes.SELECT });

    res.json({
      success: true,
      data: {
        vendors_by_city: vendorsByCity,
        vendor_performance: vendorPerformance,
        service_popularity: servicePopularity,
        summary: {
          top_performing_city: vendorsByCity[0]?.city || 'N/A',
          highest_revenue_vendor: vendorPerformance[0]?.shop_name || 'N/A',
          most_popular_service: servicePopularity[0]?.service_name || 'N/A'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/admin/cleanup/old-data
// @desc    Cleanup old data (bookings older than 2 years, etc.)
// @access  Private (Admin only)
router.delete('/cleanup/old-data', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  body('confirm').equals('DELETE_OLD_DATA').withMessage('Confirmation required')
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

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    // Count records before deletion
    const oldBookingsCount = await Booking.count({
      where: {
        created_at: { [Op.lt]: twoYearsAgo },
        booking_status: { [Op.in]: ['completed', 'cancelled'] }
      }
    });

    const oldReviewsCount = await Review.count({
      where: { created_at: { [Op.lt]: twoYearsAgo } }
    });

    // Soft delete old completed/cancelled bookings
    await Booking.update(
      { status: 'archived' },
      {
        where: {
          created_at: { [Op.lt]: twoYearsAgo },
          booking_status: { [Op.in]: ['completed', 'cancelled'] }
        }
      }
    );

    // Archive old reviews
    await Review.update(
      { status: 'archived' },
      {
        where: { created_at: { [Op.lt]: twoYearsAgo } }
      }
    );

    res.json({
      success: true,
      message: 'Old data cleanup completed',
      data: {
        archived_bookings: oldBookingsCount,
        archived_reviews: oldReviewsCount,
        cutoff_date: twoYearsAgo.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

// @route   GET /api/admin/vendors/pending
// @desc    Get pending vendor approvals
// @access  Private (Admin only)
router.get('/vendors/pending', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page number required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Valid limit required')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows: vendors } = await Vendor.findAndCountAll({
      where: { 
        verification_status: 'pending',
        status: 'active'
      },
      include: [{
        model: VerificationDocument,
        required: false
      }],
      order: [['created_at', 'ASC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        vendors,
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

// @route   PUT /api/admin/vendors/:vendor_id/approve
// @desc    Approve vendor application
// @access  Private (Admin only)
router.put('/vendors/:vendor_id/approve', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  body('admin_comments').optional().isLength({ max: 1000 }).withMessage('Comments too long')
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
    const { admin_comments } = req.body;

    const vendor = await Vendor.findByPk(vendor_id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    if (vendor.verification_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Vendor is not in pending status'
      });
    }

    await vendor.update({
      verification_status: 'approved',
      is_verified: true,
      admin_comments: admin_comments || 'Approved by admin'
    });

    // TODO: Send approval notification to vendor

    res.json({
      success: true,
      message: 'Vendor approved successfully',
      data: { vendor }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/vendors/:vendor_id/reject
// @desc    Reject vendor application
// @access  Private (Admin only)
router.put('/vendors/:vendor_id/reject', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  body('admin_comments').notEmpty().withMessage('Rejection reason is required'),
  body('admin_comments').isLength({ max: 1000 }).withMessage('Comments too long')
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
    const { admin_comments } = req.body;

    const vendor = await Vendor.findByPk(vendor_id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    if (vendor.verification_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Vendor is not in pending status'
      });
    }

    await vendor.update({
      verification_status: 'rejected',
      is_verified: false,
      admin_comments
    });

    // TODO: Send rejection notification to vendor

    res.json({
      success: true,
      message: 'Vendor application rejected',
      data: { vendor }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/vendors
// @desc    Get all vendors with filtering
// @access  Private (Admin only)
router.get('/vendors', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page number required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Valid limit required'),
  query('verification_status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Valid verification status required'),
  query('city').optional().isLength({ min: 2 }).withMessage('Valid city required'),
  query('search').optional().isLength({ min: 2 }).withMessage('Search term must be at least 2 characters')
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

    const {
      page = 1,
      limit = 10,
      verification_status,
      city,
      search
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where conditions
    let whereConditions = {};

    if (verification_status) {
      whereConditions.verification_status = verification_status;
    }

    if (city) {
      whereConditions.city = { [Op.iLike]: `%${city}%` };
    }

    if (search) {
      whereConditions[Op.or] = [
        { shop_name: { [Op.iLike]: `%${search}%` } },
        { owner_name: { [Op.iLike]: `%${search}%` } },
        { shop_address: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: vendors } = await Vendor.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: Booking,
          required: false,
          where: { booking_status: 'completed' }
        },
        {
          model: Review,
          required: false
        }
      ],
      attributes: [
        'vendor_id',
        'owner_name',
        'phone_number',
        'shop_name',
        'city',
        'state',
        'verification_status',
        'status',
        'created_at',
        [sequelize.fn('COUNT', sequelize.col('Bookings.booking_id')), 'total_bookings'],
        [sequelize.fn('AVG', sequelize.col('Reviews.rating')), 'avg_rating']
      ],
      group: ['Vendor.vendor_id'],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        vendors,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_count: count,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/vendors/:vendor_id/deactivate
// @desc    Deactivate vendor account
// @access  Private (Admin only)
router.put('/vendors/:vendor_id/deactivate', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  body('reason').notEmpty().withMessage('Deactivation reason is required'),
  body('reason').isLength({ max: 1000 }).withMessage('Reason too long')
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
    const { reason } = req.body;

    const vendor = await Vendor.findByPk(vendor_id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    if (vendor.status === 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'Vendor is already deactivated'
      });
    }

    // Check for upcoming bookings
    const upcomingBookings = await Booking.count({
      where: {
        vendor_id,
        booking_status: 'confirmed',
        booking_date: { [Op.gte]: new Date().toISOString().split('T')[0] }
      }
    });

    if (upcomingBookings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot deactivate vendor with ${upcomingBookings} upcoming bookings`,
        suggestion: 'Please handle existing bookings first or force deactivate with notification to customers'
      });
    }

    await vendor.update({
      status: 'inactive',
      admin_comments: `Deactivated by admin. Reason: ${reason}`
    });

    // TODO: Send deactivation notification to vendor

    res.json({
      success: true,
      message: 'Vendor deactivated successfully',
      data: { vendor }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/admin/send-notification
// @desc    Send notification to users/vendors
// @access  Private (Admin only)
router.post('/send-notification', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  body('title').notEmpty().withMessage('Notification title is required'),
  body('message').notEmpty().withMessage('Notification message is required'),
  body('recipient_type').isIn(['all_users', 'all_vendors', 'specific_user', 'specific_vendor']).withMessage('Valid recipient type required'),
  body('recipient_id').optional().isInt().withMessage('Valid recipient ID required')
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

    const { title, message, recipient_type, recipient_id } = req.body;
    let notifications = [];

    switch (recipient_type) {
      case 'all_users':
        const allUsers = await User.findAll({
          where: { status: 'active' },
          attributes: ['user_id']
        });
        
        notifications = await Promise.all(
          allUsers.map(user => 
            Notification.create({
              user_id: user.user_id,
              notification_type: 'admin_announcement',
              title,
              message
            })
          )
        );
        break;

      case 'all_vendors':
        const allVendors = await Vendor.findAll({
          where: { status: 'active', verification_status: 'approved' },
          attributes: ['vendor_id']
        });
        
        notifications = await Promise.all(
          allVendors.map(vendor => 
            Notification.create({
              vendor_id: vendor.vendor_id,
              notification_type: 'admin_announcement',
              title,
              message
            })
          )
        );
        break;

      case 'specific_user':
        if (!recipient_id) {
          return res.status(400).json({
            success: false,
            message: 'Recipient ID required for specific user notification'
          });
        }
        
        const notification = await Notification.create({
          user_id: recipient_id,
          notification_type: 'admin_message',
          title,
          message
        });
        notifications = [notification];
        break;

      case 'specific_vendor':
        if (!recipient_id) {
          return res.status(400).json({
            success: false,
            message: 'Recipient ID required for specific vendor notification'
          });
        }
        
        const vendorNotification = await Notification.create({
          vendor_id: recipient_id,
          notification_type: 'admin_message',
          title,
          message
        });
        notifications = [vendorNotification];
        break;
    }

    res.json({
      success: true,
      message: `Notification sent to ${notifications.length} recipient(s)`,
      data: {
        notifications_sent: notifications.length,
        recipient_type
      }
    });
  } catch (error) {
    next(error);
  }
});
