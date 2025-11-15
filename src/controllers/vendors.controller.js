// src/controllers/vendors.controller.js
const VendorService = require('../services/vendordata.service'); // New service layer
const { successResponse, errorResponse } = require('../utils/helpers/response.helper');

class VendorsController {

  /**
   * Search and filter vendors
   * @route GET /api/vendors/search
   */
  async searchVendors(req, res, next) {
    try {
      // Pass all query parameters directly to the service
      const result = await VendorService.searchVendors(req.query);
      
      return successResponse(res, 'Vendors retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendor details by ID (Public)
   * @route GET /api/vendors/:vendor_id
   */
  async getVendorById(req, res, next) {
    try {
      const { vendor_id } = req.params;

      const result = await VendorService.getVendorById(vendor_id);
      
      return successResponse(res, 'Vendor retrieved successfully', { vendor: result });
    } catch (error) {
      // Assuming the service throws a NotFoundError if vendor is not found
      next(error);
    }
  }
  
  // --- Vendor Profile Management ---

  /**
   * Update vendor profile (Vendor only)
   * @route PUT /api/vendors/profile
   */
  async updateProfile(req, res, next) {
    try {
      const vendorId = req.user.userId;
      
      const result = await VendorService.updateProfile(vendorId, req.body);
      
      return successResponse(res, 'Profile updated successfully', { vendor: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload vendor images (Vendor only)
   * @route POST /api/vendors/images
   */
  async uploadImages(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return errorResponse(res, 'No images uploaded', 400);
      }

      const vendorId = req.user.userId;
      const { image_type = 'gallery' } = req.body;
      const files = req.files;

      const result = await VendorService.uploadImages(vendorId, files, image_type);
      
      return successResponse(res, 'Images uploaded successfully', { images: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete vendor image (Vendor only)
   * @route DELETE /api/vendors/images/:image_id
   */
  async deleteImage(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { image_id } = req.params;

      await VendorService.deleteImage(vendorId, image_id);
      
      return successResponse(res, 'Image deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // --- Availability Management ---

  /**
   * Add holiday dates (Vendor only)
   * @route POST /api/vendors/holidays
   */
  async addHoliday(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { holiday_date, holiday_reason } = req.body;

      // Note: The service will handle the check and the complex task of canceling bookings.
      const result = await VendorService.addHoliday(vendorId, holiday_date, holiday_reason);
      
      return successResponse(res, 'Holiday added successfully', { holiday: result }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set early closure for a date (Vendor only)
   * @route POST /api/vendors/early-closure
   */
  async setEarlyClosure(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { closure_date, early_close_time, reason } = req.body;

      // Note: The service will handle validation against regular close time and updating/creating the closure.
      const { earlyClosure, created } = await VendorService.setEarlyClosure(
        vendorId, closure_date, early_close_time, reason
      );
      
      const message = created ? 'Early closure set successfully' : 'Early closure updated successfully';

      return successResponse(res, message, { early_closure: earlyClosure }, created ? 201 : 200);
    } catch (error) {
      next(error);
    }
  }

  // --- Account Status Management ---

  /**
   * Deactivate vendor account (Vendor only)
   * @route PUT /api/vendors/deactivate
   */
  async deactivateAccount(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { reason } = req.body;

      await VendorService.deactivateAccount(vendorId, reason);
      
      return successResponse(res, 'Account deactivated successfully. You can contact admin to reactivate.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft delete vendor (Vendor or Admin)
   * @route DELETE /api/vendors/:vendor_id/soft-delete
   */
  async removeVendor(req, res, next) {
    try {
      const { vendor_id } = req.params;
      const { userId, role } = req.user;

      const result = await VendorService.removeVendor(vendor_id, userId, role);

      return successResponse(res, 'Vendor deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Permanently delete vendor (Admin only)
   * @route DELETE /api/vendors/:vendor_id/hard-delete
   */
  async permanentlyDeleteVendor(req, res, next) {
    try {
      const { vendor_id } = req.params;
      const { role } = req.user;

      const result = await VendorService.permanentlyDeleteVendor(vendor_id, role);

      return successResponse(res, 'Vendor permanently deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // --- Dashboard and Stats ---

  /**
   * Get vendor dashboard statistics (Vendor only)
   * @route GET /api/vendors/dashboard/stats
   */
  async getDashboardStats(req, res, next) {
    try {
      const vendorId = req.user.userId;
      
      const result = await VendorService.getDashboardStats(vendorId);
      
      return successResponse(res, 'Dashboard Loaded', result);
    } catch (error) {
      next(error);
    }
  }

  // --- Service Management ---

  /**
   * Get vendor services list (Vendor only)
   * @route GET /api/vendors/services
   */
  async getVendorServices(req, res, next) {
    try {
      const vendorId = req.user.userId;
      
      const result = await VendorService.getVendorServices(vendorId, req.query);
      
      return successResponse(res, 'Services retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single service details (Vendor only)
   * @route GET /api/vendors/services/:service_id
   */
  async getServiceById(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { service_id } = req.params;

      const result = await VendorService.getServiceById(vendorId, service_id);
      
      return successResponse(res, 'Service retrieved successfully', { service: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add or update vendor service (Vendor only)
   * @route POST /api/vendors/services
   */
  async addOrUpdateService(req, res, next) {
    try {
      const vendorId = req.user.userId;
      
      const { vendorService, isNew } = await VendorService.addOrUpdateService(vendorId, req.body);

      const message = isNew ? 'Service added successfully' : 'Service updated successfully';

      return successResponse(res, message, { service: vendorService }, isNew ? 201 : 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle service availability (Vendor only)
   * @route PATCH /api/vendors/services/:service_id/availability
   */
  async toggleServiceAvailability(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { service_id } = req.params;
      const { is_available } = req.body;

      if (is_available === undefined) {
        return errorResponse(res, 'is_available boolean field is required', 400);
      }
      
      const result = await VendorService.toggleServiceAvailability(vendorId, service_id, is_available);

      const status = result.is_available ? 'enabled' : 'disabled';
      
      return successResponse(res, `Service ${status} successfully`, { service: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove Vendor Service (Soft delete/Deactivate) (Vendor only)
   * @route DELETE /api/vendors/services/:service_id
   */
  async removeVendorService(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { service_id } = req.params;

      await VendorService.removeVendorService(vendorId, service_id);
      
      return successResponse(res, 'Service removed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Permanently delete service (Hard delete - Admin or specific criteria)
   * @route DELETE /api/vendors/services/:service_id/hard
   */
  async permanentlyDeleteService(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { service_id } = req.params;

      await VendorService.permanentlyDeleteService(vendorId, service_id);

      return successResponse(res, 'Service permanently deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk update services (Vendor only)
   * @route PUT /api/vendors/services/bulk
   */
  async bulkUpdateServices(req, res, next) {
    try {
      const vendorId = req.user.userId;
      const { service_ids, updates } = req.body;

      if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
        return errorResponse(res, 'service_ids array is required', 400);
      }

      if (!updates || Object.keys(updates).length === 0) {
        return errorResponse(res, 'updates object is required', 400);
      }
      
      const result = await VendorService.bulkUpdateServices(vendorId, service_ids, updates);

      return successResponse(res, `${result.affected_count} service(s) updated successfully`, result);
    } catch (error) {
      next(error);
    }
  }


}

module.exports = new VendorsController();