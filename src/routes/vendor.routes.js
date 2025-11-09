const express = require('express');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const vendorController = require('../controllers/vendors.controller');
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

// Validation middleware wrapper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// @route   GET /api/vendors/search
// @desc    Search vendors by filters
// @access  Public
router.get('/search', [
  query('city').optional().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  query('service_type').optional().isLength({ min: 2 }).withMessage('Service type required'),
  query('rating').optional().isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1-5'),
  query('sort_by').optional().isIn(['rating', 'distance', 'price', 'most_booked']).withMessage('Invalid sort option'),
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page number required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Valid limit required'),
  validate
], vendorController.searchVendors);

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
  body('no_of_workers').optional().isInt({ min: 1 }).withMessage('Number of workers must be at least 1'),
  validate
], vendorController.updateProfile);

// @route   GET /api/vendors/services
// @desc    Get vendor services
// @access  Private (Vendor only)
router.get('/services', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], vendorController.getVendorServices);

// @route   GET /api/vendors/services/:service_id
// @desc    Get single service details
// @access  Private (Vendor only)
router.get('/services/:service_id', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], vendorController.getServiceById);

// @route   POST /api/vendors/services
// @desc    Add or update vendor service
// @access  Private (Vendor only)
router.post('/services', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('service_id').notEmpty().withMessage('Service ID is required'),
  body('service_name').notEmpty().isLength({ min: 2 }).withMessage('Service name must be at least 2 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  body('category').optional().notEmpty().withMessage('Category cannot be empty'),
  body('is_available').optional().isBoolean().withMessage('is_available must be boolean'),
  validate
], vendorController.addOrUpdateService);

// @route   PATCH /api/vendors/services/:service_id/availability
// @desc    Toggle service availability
// @access  Private (Vendor only)
router.patch('/services/:service_id/availability', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('is_available').isBoolean().withMessage('is_available must be boolean'),
  validate
], vendorController.toggleServiceAvailability);

// @route   DELETE /api/vendors/services/:service_id
// @desc    Remove vendor service (soft delete)
// @access  Private (Vendor only)
router.delete('/services/:service_id', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], vendorController.removeVendorService);

// @route   DELETE /api/vendors/services/:service_id/permanent
// @desc    Permanently delete service
// @access  Private (Vendor only)
router.delete('/services/:service_id/permanent', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], vendorController.permanentlyDeleteService);

// @route   PUT /api/vendors/services/bulk
// @desc    Bulk update services
// @access  Private (Vendor only)
router.put('/services/bulk', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('service_ids').isArray({ min: 1 }).withMessage('service_ids must be a non-empty array'),
  body('updates').isObject().withMessage('updates must be an object'),
  validate
], vendorController.bulkUpdateServices);

// @route   POST /api/vendors/images
// @desc    Upload vendor images
// @access  Private (Vendor only)
router.post('/images', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  upload.array('images', 10) // Max 10 images
], vendorController.uploadImages);

// @route   DELETE /api/vendors/images/:image_id
// @desc    Delete vendor image
// @access  Private (Vendor only)
router.delete('/images/:image_id', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus
], vendorController.deleteImage);

// @route   POST /api/vendors/holidays
// @desc    Add holiday dates
// @access  Private (Vendor only)
router.post('/holidays', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('holiday_date').isDate().withMessage('Valid holiday date required'),
  body('holiday_reason').optional().isLength({ max: 255 }).withMessage('Holiday reason too long'),
  validate
], vendorController.addHoliday);

// @route   POST /api/vendors/early-closure
// @desc    Set early closure for a date
// @access  Private (Vendor only)
router.post('/early-closure', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('closure_date').isDate().withMessage('Valid closure date required'),
  body('early_close_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid early close time required'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason too long'),
  validate
], vendorController.setEarlyClosure);

// @route   PUT /api/vendors/deactivate
// @desc    Deactivate vendor account
// @access  Private (Vendor only)
router.put('/deactivate', [
  authenticateToken,
  authorize('vendor'),
  verifyUserStatus,
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason too long'),
  validate
], vendorController.deactivateAccount);

// @route   GET /api/vendors/dashboard/stats
// @desc    Get vendor dashboard statistics
// @access  Private (Vendor only)
router.get('/dashboard/stats', [
  authenticateToken,
  authorize('vendor'),
  // verifyUserStatus
], vendorController.getDashboardStats);

// @route   GET /api/vendors/:vendor_id
// @desc    Get vendor details by ID
// @access  Public
router.get('/:vendor_id', vendorController.getVendorById);

// @route   DELETE /api/vendors/:vendor_id
// @desc    Soft delete vendor (set status to deleted)
// @access  Private (Admin or Vendor themselves)
router.delete('/:vendor_id', [
  authenticateToken,
  authorize('admin', 'vendor'),
  verifyUserStatus
], vendorController.removeVendor);

// @route   DELETE /api/vendors/:vendor_id/permanent
// @desc    Permanently delete vendor (hard delete)
// @access  Private (Admin only)
router.delete('/:vendor_id/permanent', [
  authenticateToken,
  authorize('admin')
], vendorController.permanentlyDeleteVendor);

module.exports = router;