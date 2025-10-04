const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { ServicesMaster } = require('../models');
const { authenticateToken, authorize, verifyUserStatus } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/services
// @desc    Get all services
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page number required'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Valid limit required'),
  query('service_type').optional().isIn(['normal', 'advance']).withMessage('Valid service type required'),
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
      limit = 50,
      service_type,
      search
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where conditions
    let whereConditions = {
      status: 'active'
    };

    if (service_type) {
      whereConditions.service_type = service_type;
    }

    if (search) {
      whereConditions[Op.or] = [
        { service_name: { [Op.iLike]: `%${search}%` } },
        { service_description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: services } = await ServicesMaster.findAndCountAll({
      where: whereConditions,
      limit: parseInt(limit),
      offset,
      order: [['service_name', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        services,
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

// @route   GET /api/services/:service_id
// @desc    Get service by ID
// @access  Public
router.get('/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    const service = await ServicesMaster.findOne({
      where: { 
        service_id,
        status: 'active'
      }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      data: { service }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/services
// @desc    Add new service (Admin only)
// @access  Private (Admin only)
router.post('/', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  body('service_name').trim().isLength({ min: 2 }).withMessage('Service name must be at least 2 characters'),
  body('service_description').optional().isLength({ max: 1000 }).withMessage('Description too long'),
  body('default_duration_minutes').isInt({ min: 5, max: 180 }).withMessage('Duration must be between 5-180 minutes'),
  body('service_type').isIn(['normal', 'advance']).withMessage('Service type must be normal or advance')
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

    const { service_name, service_description, default_duration_minutes, service_type } = req.body;

    // Check if service already exists
    const existingService = await ServicesMaster.findOne({
      where: { service_name: service_name.trim() }
    });

    if (existingService) {
      return res.status(409).json({
        success: false,
        message: 'Service with this name already exists'
      });
    }

    const service = await ServicesMaster.create({
      service_name: service_name.trim(),
      service_description,
      default_duration_minutes,
      service_type,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/services/:service_id
// @desc    Update service (Admin only)
// @access  Private (Admin only)
router.put('/:service_id', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus,
  body('service_name').optional().trim().isLength({ min: 2 }).withMessage('Service name must be at least 2 characters'),
  body('service_description').optional().isLength({ max: 1000 }).withMessage('Description too long'),
  body('default_duration_minutes').optional().isInt({ min: 5, max: 180 }).withMessage('Duration must be between 5-180 minutes'),
  body('service_type').optional().isIn(['normal', 'advance']).withMessage('Service type must be normal or advance')
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

    const { service_id } = req.params;
    const updateData = { ...req.body };

    const service = await ServicesMaster.findByPk(service_id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check if new service name already exists (if being updated)
    if (updateData.service_name) {
      const existingService = await ServicesMaster.findOne({
        where: { 
          service_name: updateData.service_name.trim(),
          service_id: { [Op.ne]: service_id }
        }
      });

      if (existingService) {
        return res.status(409).json({
          success: false,
          message: 'Service with this name already exists'
        });
      }

      updateData.service_name = updateData.service_name.trim();
    }

    await service.update(updateData);

    res.json({
      success: true,
      message: 'Service updated successfully',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/services/:service_id
// @desc    Delete service (Admin only) - Soft delete
// @access  Private (Admin only)
router.delete('/:service_id', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const { service_id } = req.params;

    const service = await ServicesMaster.findByPk(service_id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check if service is being used by vendors
    const vendorServicesCount = await VendorService.count({
      where: { service_id, status: 'active' }
    });

    if (vendorServicesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete service. It is currently being offered by ${vendorServicesCount} vendor(s)`,
        warning: 'Consider deactivating instead of deleting'
      });
    }

    // Soft delete
    await service.update({ status: 'deleted' });

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/services/:service_id/toggle-status
// @desc    Toggle service active/inactive status (Admin only)
// @access  Private (Admin only)
router.put('/:service_id/toggle-status', [
  authenticateToken,
  authorize('admin'),
  verifyUserStatus
], async (req, res, next) => {
  try {
    const { service_id } = req.params;

    const service = await ServicesMaster.findByPk(service_id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    const newStatus = service.status === 'active' ? 'inactive' : 'active';
    await service.update({ status: newStatus });

    res.json({
      success: true,
      message: `Service ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: { service }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/services/popular
// @desc    Get popular services based on bookings
// @access  Public
router.get('/stats/popular', [
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Valid limit required')
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

    const limit = parseInt(req.query.limit) || 10;

    // Get popular services based on booking count
    const popularServices = await ServicesMaster.findAll({
      include: [{
        model: BookingService,
        include: [{
          model: Booking,
          where: { booking_status: 'completed' },
          required: true
        }],
        required: false
      }],
      where: { status: 'active' },
      attributes: [
        'service_id',
        'service_name',
        'service_description',
        'default_duration_minutes',
        'service_type',
        [sequelize.fn('COUNT', sequelize.col('BookingServices.booking_service_id')), 'booking_count']
      ],
      group: ['ServicesMaster.service_id'],
      order: [[sequelize.fn('COUNT', sequelize.col('BookingServices.booking_service_id')), 'DESC']],
      limit
    });

    res.json({
      success: true,
      data: { popular_services: popularServices }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;