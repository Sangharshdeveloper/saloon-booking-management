const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, authorizeVendor } = require('../middleware/authMiddleware');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Customer registration
router.post('/register/customer', authController.registerCustomer);

// Vendor registration
router.post('/register/vendor', authController.registerVendor);

// Unified login (for customers and vendors)
router.post('/login', authController.login);

// Admin login
router.post('/admin-login', authController.adminLogin);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Get user profile
router.get('/profile', authenticate, authController.getProfile);

// Update user profile
router.put('/profile', authenticate, authController.updateProfile);

// Change password
router.put('/change-password', authenticate, authController.changePassword);

// Update vendor shop (vendor only)
router.put('/vendor/shop', authenticate, authorizeVendor, authController.updateVendorShop);

// Delete account
router.delete('/account', authenticate, authController.deleteAccount);

module.exports = router; 