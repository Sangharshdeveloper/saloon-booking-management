// src/controllers/auth.controller.js
const AuthService = require('../services/auth.service'); // Assuming you'll create this service
const { successResponse, errorResponse } = require('../utils/helpers/response.helper');

class AuthController {
  
  /**
   * Customer Registration
   * @route POST /api/auth/register/customer
   */
  async registerCustomer(req, res, next) {
    try {
      const { name, phone_number, password } = req.body;
      
      // Basic validation (more comprehensive validation should be in middleware/service)
      if (!name || !phone_number || !password) {
        return errorResponse(res, 'Name, phone number and password are required', 400);
      }
      
      const result = await AuthService.registerCustomer(req.body);

      return successResponse(res, 'Customer registered successfully', result, 201);
    } catch (error) {
      next(error); // Pass error to the error middleware
    }
  }

  /**
   * Vendor Registration
   * @route POST /api/auth/register/vendor
   */
  async registerVendor(req, res, next) {
    try {
      const { name, phone_number, password, shop_name, shop_address } = req.body;

      // Basic validation
      if (!name || !phone_number || !password || !shop_name || !shop_address) {
        return errorResponse(res, 'Required fields missing for vendor registration', 400);
      }
      
      const result = await AuthService.registerVendor(req.body);

      return successResponse(res, 'Vendor registered successfully. Awaiting admin approval.', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unified Login (Customer/Vendor)
   * @route POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { phone_number, password } = req.body;

      if (!phone_number || !password) {
        return errorResponse(res, 'Phone number and password are required', 400);
      }

      const result = await AuthService.login(req.body);
      
      return successResponse(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin Login
   * @route POST /api/auth/admin-login
   */
  async adminLogin(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return errorResponse(res, 'Email and password are required', 400);
      }

      const result = await AuthService.adminLogin(req.body);

      return successResponse(res, 'Admin login successful', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get User/Vendor Profile
   * @route GET /api/auth/profile
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user.user_id; // From JWT middleware
      
      const result = await AuthService.getProfile(userId, req.user.user_type);
      
      // Check if the service returns null/undefined (e.g., user not found)
      if (!result) {
        return errorResponse(res, 'User not found', 404);
      }
      
      return successResponse(res, 'Profile retrieved successfully', { user: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update User Profile
   * @route PUT /api/auth/profile
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.user_id;
      
      const result = await AuthService.updateProfile(userId, req.body);

      return successResponse(res, 'Profile updated successfully', { user: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change Password
   * @route PUT /api/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { current_password, new_password } = req.body;

      // Basic validation
      if (!current_password || !new_password) {
        return errorResponse(res, 'Current and new password are required', 400);
      }
      
      // Service will handle password validation, hashing, and update
      await AuthService.changePassword(userId, current_password, new_password);

      return successResponse(res, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Vendor Shop Details
   * @route PUT /api/auth/vendor-shop
   */
  async updateVendorShop(req, res, next) {
    try {
      const userId = req.user.user_id;
      
      // Authorization check (can be moved to a route middleware for cleanliness)
      if (req.user.user_type !== 'vendor') {
        return errorResponse(res, 'Access denied. Only vendors can update shop details.', 403);
      }
      
      const result = await AuthService.updateVendorShop(userId, req.body);

      return successResponse(res, 'Shop details updated successfully', { shop: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete Account (Soft Delete)
   * @route DELETE /api/auth/delete-account
   */
  async deleteAccount(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { password } = req.body;

      if (!password) {
        return errorResponse(res, 'Password is required to delete account', 400);
      }

      await AuthService.deleteAccount(userId, password);

      return successResponse(res, 'Account deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();