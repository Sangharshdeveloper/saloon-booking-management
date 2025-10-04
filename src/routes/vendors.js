const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const { 
  Vendor, 
  VendorService, 
  VendorImage, 
  ServicesMaster, 
  VendorHoliday,
  VendorEarlyClosure,
  Review,
  Booking
} = require('../models');
const { authenticateToken, authorize, verifyUserStatus } = require('../middleware/auth');

const router = express.Router();

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/vendors/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// @route   GET /api/vendors/search
// @desc    Search vendors by filters
// @access  Public
router.get('/search', [
  query('city').optional().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  query('service_type').optional().isLength({ min: 2 }).withMessage('Service type required'),
  query('rating').optional().isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1-5'),
  query('sort_by').optional().isIn(['rating', 'distance', 'price', 'most_booked']).withMessage('Invalid sort option'),
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

    const {
      city,
      service_type,
      rating,
      sort_by = 'rating',
      page = 1,
      limit = 10,
      search
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where conditions
    let whereConditions = {
      verification_status: 'approved',
      status: 'active'
    };

    if (city) {
      whereConditions.city = { [Op.iLike]: `%${city}%` };
    }

    if (search) {
      whereConditions[Op.or] = [
        { shop_name: { [Op.iLike]: `%${search}%` } },
        { shop_address: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Include conditions
    let includeConditions = [
      {
        model: VendorService,
        where: { status: 'active', is_available: true },
        include: [ServicesMaster],
        required: false
      },
      {
        model: VendorImage,
        where: { status: 'active' },
        required: false
      },
      {
        model: Review,
        required: false,
        attributes: ['rating']
      }
    ];

    // Filter by service type
    if (service_type) {
      includeConditions[0].include[0].where = {
        service_name: { [Op.iLike]: `%${service_type}%` }
      };
      includeConditions[0].required = true;
    }

    const { count, rows: vendors } = await Vendor.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    // Calculate additional fields for each vendor
    const vendorsWithStats = await Promise.all(vendors.map(async (vendor) => {
      const vendorData = vendor.toJSON();
      
      // Calculate average rating
      const avgRating = vendor.Reviews.length > 0 
        ? vendor.Reviews.reduce((sum, review) => sum + review.rating, 0) / vendor.Reviews.length 
        : 0;
      
      // Get minimum service price
      const minPrice = vendor.VendorServices.length > 0 
        ? Math.min(...vendor.VendorServices.map(service => parseFloat(service.price)))
        : 0;
      
      // Get booking count (for most_booked sort)
      const bookingCount = await Booking.count({
        where: { 
          vendor_id: vendor.vendor_id,
          booking_status: 'completed'
        }
      });

      // Get primary image
      const primaryImage = vendor.VendorImages.find(img => img.image_type === 'homepage') ||
                          vendor.VendorImages[0];

      return {
        ...vendorData,
        average_rating: Math.round(avgRating * 10) / 10,
        total_reviews: vendor.Reviews.length,
        min_price: minPrice,
        booking_count: bookingCount,
        primary_image: primaryImage?.image_url || null,
        total_images: vendor.VendorImages.length
      };
    }));

    // Apply sorting
    switch (sort_by) {
      case 'rating':
        vendorsWithStats.sort((a, b) => b.average_rating - a.average_rating);
        break;
      case 'price':
        vendorsWithStats.sort((a, b) => a.min_price - b.min_price);
        break;
      case 'most_booked':
        vendorsWithStats.sort((a, b) => b.booking_count - a.booking_count);
        break;
      case 'distance':
        // TODO: Implement distance-based sorting using user location
        break;
    }

    // Apply rating filter after calculating
    const filteredVendors = rating 
      ? vendorsWithStats.filter(vendor => vendor.average_rating >= parseFloat(rating))
      : vendorsWithStats;

    res.json({
      success: true,
      data: {
        vendors: filteredVendors,
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

// @route   GET /api/vendors/:vendor_id
// @desc    Get vendor details by ID
// @access  Public
router.get('/:vendor_id', async (req, res, next) => {
  try {
    const { vendor_id } = req.params;

    const vendor = await Vendor.findOne({
      where: { 
        vendor_id,
        verification_status: 'approved',
        status: 'active'
      },
      include: [
        {
          model: VendorService,
          where: { status: 'active', is_available: true },
          include: [ServicesMaster],
          required: false
        },
        {
          model: VendorImage,
          where: { status: 'active' },
          required: false
        },
        {
          model: Review,
          include: [{
            model: User,
            attributes: ['name']
          }],
          limit: 10,
          order: [['created_at', 'DESC']],
          required: false
        }
      ]
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Calculate additional stats
    const totalReviews = await Review.count({
      where: { vendor_id }
    });

    const avgRating = vendor.Reviews.length > 0 
      ? vendor.Reviews.reduce((sum, review) => sum + review.rating, 0) / vendor.Reviews.length 
      : 0;

    const vendorData = {
      ...vendor.toJSON(),
      average_rating: Math.round(avgRating * 10) / 10,
      total_reviews: totalReviews
    };

    res.json({
      success: true,
      data: { vendor: vendorData }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/vendors/profile
// @desc    Update vendor profile
// @access  Private (Vendor only)
router.put('/profile', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('shop_name').optional().isLength({ min: 2 }).withMessage('Shop name must be at least 2 characters'),
  body('shop_address').optional().isLength({ min: 10 }).withMessage('Shop address must be at least 10 characters'),
  body('open_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid open time required'),
  body('close_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid close time required'),
  body('no_of_seats').optional().isInt({ min: 1 }).withMessage('Number of seats must be at least 1'),
  body('no_of_workers').optional().isInt({ min: 1 }).withMessage('Number of workers must be at least 1')
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

    const vendor_id = req.user.userId;
    const updateData = { ...req.body };

    // Remove fields that cannot be updated
    delete updateData.phone_number;
    delete updateData.verification_status;

    const vendor = await Vendor.findByPk(vendor_id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    await vendor.update(updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { vendor }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/vendors/services
// @desc    Add/update vendor services
// @access  Private (Vendor only)
router.post('/services', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('services').isArray({ min: 1 }).withMessage('Services array required'),
  body('services.*.service_id').isInt().withMessage('Valid service ID required'),
  body('services.*.price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('services.*.is_available').optional().isBoolean().withMessage('is_available must be boolean')
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

    const vendor_id = req.user.userId;
    const { services } = req.body;

    // Validate all service IDs exist
    const serviceIds = services.map(s => s.service_id);
    const existingServices = await ServicesMaster.findAll({
      where: { 
        service_id: serviceIds,
        status: 'active'
      }
    });

    if (existingServices.length !== serviceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some service IDs are invalid'
      });
    }

    // Update or create vendor services
    const vendorServices = await Promise.all(
      services.map(async (service) => {
        const [vendorService, created] = await VendorService.findOrCreate({
          where: { vendor_id, service_id: service.service_id },
          defaults: {
            vendor_id,
            service_id: service.service_id,
            price: service.price,
            is_available: service.is_available !== undefined ? service.is_available : true
          }
        });

        if (!created) {
          await vendorService.update({
            price: service.price,
            is_available: service.is_available !== undefined ? service.is_available : vendorService.is_available
          });
        }

        return vendorService;
      })
    );

    res.json({
      success: true,
      message: 'Services updated successfully',
      data: { services: vendorServices }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/vendors/services/:service_id
// @desc    Remove vendor service
// @access  Private (Vendor only)
router.delete('/services/:service_id', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const vendor_id = req.user.userId;
    const { service_id } = req.params;

    const vendorService = await VendorService.findOne({
      where: { vendor_id, service_id }
    });

    if (!vendorService) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check for existing bookings with this service
    const hasBookings = await BookingService.count({
      include: [{
        model: Booking,
        where: { vendor_id, booking_status: ['confirmed'] }
      }],
      where: { service_id }
    });

    if (hasBookings > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove service with existing bookings. Set as unavailable instead.',
        warning: 'This may affect existing bookings and will need to be handled offline'
      });
    }

    await vendorService.destroy();

    res.json({
      success: true,
      message: 'Service removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/vendors/images
// @desc    Upload vendor images
// @access  Private (Vendor only)
router.post('/images', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  upload.array('images', 10) // Max 10 images
], async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const vendor_id = req.user.userId;
    const { image_type = 'gallery' } = req.body;

    // If uploading homepage image, remove existing homepage image
    if (image_type === 'homepage') {
      await VendorImage.update(
        { image_type: 'gallery' },
        { where: { vendor_id, image_type: 'homepage' } }
      );
    }

    const uploadedImages = await Promise.all(
      req.files.map(async (file, index) => {
        return await VendorImage.create({
          vendor_id,
          image_url: `/uploads/vendors/${file.filename}`,
          image_type: image_type === 'homepage' && index === 0 ? 'homepage' : 'gallery',
          is_primary: image_type === 'homepage' && index === 0
        });
      })
    );

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      data: { images: uploadedImages }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/vendors/images/:image_id
// @desc    Delete vendor image
// @access  Private (Vendor only)
router.delete('/images/:image_id', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const vendor_id = req.user.userId;
    const { image_id } = req.params;

    const image = await VendorImage.findOne({
      where: { image_id, vendor_id }
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    await image.destroy();

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/vendors/holidays
// @desc    Add holiday dates
// @access  Private (Vendor only)
router.post('/holidays', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('holiday_date').isDate().withMessage('Valid holiday date required'),
  body('holiday_reason').optional().isLength({ max: 255 }).withMessage('Holiday reason too long')
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

    const vendor_id = req.user.userId;
    const { holiday_date, holiday_reason } = req.body;

    // Check if holiday already exists
    const existingHoliday = await VendorHoliday.findOne({
      where: { vendor_id, holiday_date }
    });

    if (existingHoliday) {
      return res.status(409).json({
        success: false,
        message: 'Holiday already exists for this date'
      });
    }

    const holiday = await VendorHoliday.create({
      vendor_id,
      holiday_date,
      holiday_reason
    });

    // TODO: Cancel existing bookings for this date and notify customers

    res.status(201).json({
      success: true,
      message: 'Holiday added successfully',
      data: { holiday }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/vendors/early-closure
// @desc    Set early closure for a date
// @access  Private (Vendor only)
router.post('/early-closure', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('closure_date').isDate().withMessage('Valid closure date required'),
  body('early_close_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid early close time required'),
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

    const vendor_id = req.user.userId;
    const { closure_date, early_close_time, reason } = req.body;

    // Validate early close time is before regular close time
    const vendor = await Vendor.findByPk(vendor_id);
    if (early_close_time >= vendor.close_time) {
      return res.status(400).json({
        success: false,
        message: 'Early close time must be before regular close time'
      });
    }

    const [earlyClosure, created] = await VendorEarlyClosure.findOrCreate({
      where: { vendor_id, closure_date },
      defaults: {
        vendor_id,
        closure_date,
        early_close_time,
        reason
      }
    });

    if (!created) {
      await earlyClosure.update({
        early_close_time,
        reason
      });
    }

    // TODO: Cancel bookings affected by early closure and notify customers

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Early closure set successfully' : 'Early closure updated successfully',
      data: { early_closure: earlyClosure }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/vendors/deactivate
// @desc    Deactivate vendor account
// @access  Private (Vendor only)
router.put('/deactivate', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason too long')
], async (req, res, next) => {
  try {
    const vendor_id = req.user.userId;
    const { reason } = req.body;

    // Check for upcoming confirmed bookings
    const upcomingBookings = await Booking.count({
      where: {
        vendor_id,
        booking_status: 'confirmed',
        booking_date: { [Op.gte]: new Date() }
      }
    });

    if (upcomingBookings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot deactivate account with ${upcomingBookings} upcoming bookings. Please handle them first.`
      });
    }

    const vendor = await Vendor.findByPk(vendor_id);
    await vendor.update({
      status: 'inactive',
      admin_comments: reason ? `Deactivated by vendor. Reason: ${reason}` : 'Deactivated by vendor'
    });

    res.json({
      success: true,
      message: 'Account deactivated successfully. You can contact admin to reactivate.'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/dashboard/stats
// @desc    Get vendor dashboard statistics
// @access  Private (Vendor only)
router.get('/dashboard/stats', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const vendor_id = req.user.userId;
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get various statistics
    const [
      totalBookings,
      todaysBookings,
      completedBookings,
      monthlyRevenue,
      averageRating,
      totalReviews
    ] = await Promise.all([
      Booking.count({ where: { vendor_id } }),
      Booking.count({ 
        where: { 
          vendor_id, 
          booking_date: today.toISOString().split('T')[0],
          booking_status: ['confirmed', 'completed']
        } 
      }),
      Booking.count({ 
        where: { 
          vendor_id, 
          booking_status: 'completed' 
        } 
      }),
      Booking.sum('total_amount', {
        where: {
          vendor_id,
          booking_status: 'completed',
          created_at: { [Op.gte]: thirtyDaysAgo }
        }
      }),
      Review.findOne({
        where: { vendor_id },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating']
        ]
      }),
      Review.count({ where: { vendor_id } })
    ]);

    // Get popular services
    const popularServices = await BookingService.findAll({
      include: [{
        model: Booking,
        where: { 
          vendor_id,
          booking_status: 'completed',
          created_at: { [Op.gte]: thirtyDaysAgo }
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
          todays_bookings: todaysBookings,
          completed_bookings: completedBookings,
          monthly_revenue: monthlyRevenue || 0,
          average_rating: averageRating ? Math.round(averageRating.dataValues.avg_rating * 10) / 10 : 0,
          total_reviews: totalReviews,
          popular_services: popularServices
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;