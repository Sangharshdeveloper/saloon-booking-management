
// src/controllers/admin.controller.js
const adminService = require('../services/admin.service');
const { successResponse, errorResponse } = require('../utils/helpers/response.helper');

class AdminController {
    // Admin-specific controller methods can be added here
      /** Vendors list for admin
   * @route GET /api/admin/vendors
   */
  async getVendorsList(req, res, next) {
    try {
      const result = await adminService.getVendorsList(req.query);
      
      return successResponse(res, 'Vendors retrieved successfully', result);
    } catch (error) {
      next(error);
    }
}
  /** Vendors list for admin
   * @route GET /api/admin/vendors
   */
  async getUsersList(req, res, next) {
    try {
      const result = await adminService.getCustomersList(req.query);
      
      return successResponse(res, 'Users retrieved successfully', result);
    } catch (error) {
      next(error);
    }
}
}

module.exports = new AdminController();
