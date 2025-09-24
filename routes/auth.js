const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, Vendor, AdminUser } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// Generate JWT Token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Validation rules
const registerValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('phone_number').isMobilePhone().withMessage('Valid phone number required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const loginValidation = [
  body('phone_number').custom((value, { req }) => {
    const { user_type } = req.body;
    
    // For admin, phone_number can be email or username
    if (user_type === 'admin') {
      if (!value) {
        throw new Error('Email or username is required for admin login');
      }
      return true;
    }
    
    // For customer and vendor, validate as phone number
    if (!value || !/^\+?[1-9]\d{1,14}$/.test(value)) {
      throw new Error('Valid phone number required');
    }
    
    return true;
  }),
  body('password').notEmpty().withMessage('Password is required'),
  body('user_type').optional().isIn(['customer', 'vendor', 'admin']).withMessage('Valid user type required')
];


// @route   POST /api/auth/register/customer
// @desc    Register new customer
// @access  Public
router.post('/register/customer', registerValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, phone_number, email, password, city, state, gender } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { phone_number } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this phone number'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name,
      phone_number,
      email,
      password_hash: hashedPassword,
      city,
      state,
      gender,
      status: 'active'
    });

    // Generate token
    const token = generateToken({
      userId: user.user_id,
      phone_number: user.phone_number,
      role: 'customer'
    });

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: {
        user: {
          user_id: user.user_id,
          name: user.name,
          phone_number: user.phone_number,
          email: user.email,
          city: user.city,
          state: user.state
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/register/vendor
// @desc    Register new vendor
// @access  Public
router.post('/register/vendor', [
  ...registerValidation,
  body('shop_name').trim().isLength({ min: 2 }).withMessage('Shop name required'),
  body('shop_address').trim().isLength({ min: 10 }).withMessage('Shop address required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('open_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid open time required (HH:MM)'),
  body('close_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid close time required (HH:MM)'),
  body('no_of_seats').isInt({ min: 1 }).withMessage('Number of seats must be at least 1'),
  body('no_of_workers').isInt({ min: 1 }).withMessage('Number of workers must be at least 1')
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
      name, phone_number, email, password, shop_name, shop_address,
      city, state, latitude, longitude, open_time, close_time,
      break_start_time, break_end_time, weekly_holiday,
      no_of_seats, no_of_workers
    } = req.body;

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ where: { phone_number } });
    if (existingVendor) {
      return res.status(409).json({
        success: false,
        message: 'Vendor already exists with this phone number'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create vendor
    const vendor = await Vendor.create({
      owner_name: name,
      phone_number,
      email,
      password_hash: hashedPassword,
      shop_name,
      shop_address,
      city,
      state,
      latitude,
      longitude,
      open_time,
      close_time,
      break_start_time,
      break_end_time,
      weekly_holiday,
      no_of_seats,
      no_of_workers,
      verification_status: 'pending',
      status: 'active'
    });

    // Generate token
    const token = generateToken({
      userId: vendor.vendor_id,
      phone_number: vendor.phone_number,
      role: 'vendor'
    });

    res.status(201).json({
      success: true,
      message: 'Vendor registered successfully. Awaiting admin approval.',
      data: {
        vendor: {
          vendor_id: vendor.vendor_id,
          owner_name: vendor.owner_name,
          phone_number: vendor.phone_number,
          shop_name: vendor.shop_name,
          verification_status: vendor.verification_status
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Login user/vendor/admin
// @access  Public
router.post('/login', loginValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone_number, password, user_type = 'customer' } = req.body;
    let user, role, userIdField;

    // Determine which model to search based on user_type
    switch (user_type) {
      case 'customer':
        user = await User.findOne({ where: { phone_number, status: 'active' } });
        role = 'customer';
        userIdField = 'user_id';
        break;
      case 'vendor':
        user = await Vendor.findOne({ where: { phone_number, status: 'active' } });
        role = 'vendor';
        userIdField = 'vendor_id';
        break;
      case 'admin':
        // For admin, search by email or username
        user = await AdminUser.findOne({ 
          where: { 
            [Op.or]: [
              { email: phone_number },
              { username: phone_number }
            ],
            status: 'active'
          }
        });
        role = 'admin';
        userIdField = 'admin_id';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type'
        });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // For vendors, check verification status
    if (role === 'vendor' && user.verification_status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Account pending approval or rejected',
        verification_status: user.verification_status
      });
    }

    // Generate token
    const token = generateToken({
      userId: user[userIdField],
      phone_number: user.phone_number || user.email,
      role
    });

    // Prepare response data
    let responseData = {
      [userIdField]: user[userIdField],
      role
    };

    if (role === 'customer') {
      responseData = {
        ...responseData,
        phone_number: user.phone_number,
        name: user.name,
        email: user.email,
        city: user.city,
        state: user.state
      };
    } else if (role === 'vendor') {
      responseData = {
        ...responseData,
        phone_number: user.phone_number,
        owner_name: user.owner_name,
        shop_name: user.shop_name,
        verification_status: user.verification_status
      };
    } else if (role === 'admin') {
      responseData = {
        ...responseData,
        username: user.username,
        email: user.email,
        full_name: user.full_name
      };
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: responseData,
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email required')
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

    const { email } = req.body;

    // Check in all user tables
    const customer = await User.findOne({ where: { email, status: 'active' } });
    const vendor = await Vendor.findOne({ where: { email, status: 'active' } });

    if (!customer && !vendor) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    // Generate reset token (implement email sending logic)
    const resetToken = jwt.sign(
      { email, timestamp: Date.now() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TODO: Send email with reset link
    // await sendPasswordResetEmail(email, resetToken);

    res.json({
      success: true,
      message: 'Password reset link sent to your email',
      // Remove in production
      reset_token: resetToken
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    let user;

    switch (role) {
      case 'customer':
        user = await User.findByPk(userId, {
          attributes: { exclude: ['password_hash'] }
        });
        break;
      case 'vendor':
        user = await Vendor.findByPk(userId, {
          attributes: { exclude: ['password_hash'] }
        });
        break;
      case 'admin':
        user = await AdminUser.findByPk(userId, {
          attributes: { exclude: ['password_hash'] }
        });
        break;
    }

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

module.exports = router;