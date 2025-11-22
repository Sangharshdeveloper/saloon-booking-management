// src/routes/admin.routes.js

const express = require('express');
const router = express.Router();

// Import controllers
const vendorAdminController = require('../controllers/admin/vendor.admin.controller');
const userAdminController = require('../controllers/admin/user.admin.controller');
const serviceAdminController = require('../controllers/admin/service.admin.controller');
const bannerAdminController = require('../controllers/admin/banner.admin.controller');
const dashboardAdminController = require('../controllers/admin/dashboard.admin.controller');

// Import middlewares
const { authenticate } = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/admin.middleware');

// Apply authentication and admin middleware to all admin routes
router.use(authenticate, adminMiddleware);

// ==================== DASHBOARD ROUTES ====================
router.get('/dashboard/stats', dashboardAdminController.getDashboardStats);
router.get('/dashboard/revenue-analytics', dashboardAdminController.getRevenueAnalytics);
router.get('/dashboard/user-growth', dashboardAdminController.getUserGrowthAnalytics);
router.get('/dashboard/popular-services', dashboardAdminController.getPopularServices);
router.get('/dashboard/city-stats', dashboardAdminController.getCityWiseStats);
router.get('/dashboard/bookings-overview', dashboardAdminController.getBookingsOverview);

// ==================== VENDOR MANAGEMENT ROUTES ====================
// router.get('/vendors', vendorAdminController.getAllVendors);
// router.get('/vendors/:vendorId', vendorAdminController.getVendorDetails);
// router.post('/vendors/:vendorId/approve', vendorAdminController.approveVendor);
// router.post('/vendors/:vendorId/reject', vendorAdminController.rejectVendor);
// router.post('/vendors/:vendorId/suspend', vendorAdminController.suspendVendor);
// router.post('/vendors/:vendorId/activate', vendorAdminController.activateVendor);

// ==================== USER MANAGEMENT ROUTES ====================
// Customers
router.get('/customers', userAdminController.getAllCustomers);
router.post('/customers', userAdminController.createCustomer);

// Vendors (create)
router.post('/vendors', userAdminController.createVendor);

// General user operations
router.get('/users/:userId', userAdminController.getUserDetails);
router.patch('/users/:userId/status', userAdminController.updateUserStatus);
router.delete('/users/:userId', userAdminController.deleteUser);

// ==================== SERVICE MANAGEMENT ROUTES ====================
// Master Services
router.get('/services/master', serviceAdminController.getAllMasterServices);
router.post('/services/master', serviceAdminController.createMasterService);
router.patch('/services/master/:serviceId', serviceAdminController.updateMasterService);
router.delete('/services/master/:serviceId', serviceAdminController.deleteMasterService);

// Vendor Services
router.get('/services/vendor', serviceAdminController.getAllVendorServices);
router.post('/services/vendor', serviceAdminController.createVendorService);
router.patch('/services/vendor/:serviceId', serviceAdminController.updateVendorService);
router.delete('/services/vendor/:serviceId', serviceAdminController.deleteVendorService);

// ==================== BANNER MANAGEMENT ROUTES ====================
router.get('/banners', bannerAdminController.getAllBanners);
router.get('/banners/active', bannerAdminController.getActiveBanners);
router.get('/banners/:bannerId', bannerAdminController.getBannerDetails);
router.post('/banners', bannerAdminController.createBanner);
router.patch('/banners/:bannerId', bannerAdminController.updateBanner);
router.patch('/banners/:bannerId/status', bannerAdminController.updateBannerStatus);
router.post('/banners/reorder', bannerAdminController.reorderBanners);
router.delete('/banners/:bannerId', bannerAdminController.deleteBanner);

module.exports = router;