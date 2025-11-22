// src/controllers/admin/vendor.admin.controller.js

const db = require('../../config/database');
const { sendSuccessResponse, sendErrorResponse } = require('../../utils/helpers/response.helper');
const { USER_TYPES } = require('../../constants');

class VendorAdminController {
  // Get all vendors with pagination and filters
  async getAllVendors(req, res) {
    try {
      const { page = 1, limit = 10, status, search } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          u.user_id,
          u.name,
          u.email,
          u.phone_number,
          u.user_type,
          u.status as user_status,
          u.city,
          u.state,
          u.profile_picture,
          u.created_at,
          vs.shop_id,
          vs.shop_name,
          vs.verification_status,
          vs.average_rating,
          vs.total_reviews,
          vs.total_bookings,
          vs.total_revenue,
          vs.business_license,
          vs.tax_number
        FROM users u
        INNER JOIN vendor_shops vs ON u.user_id = vs.user_id AND vs.deleted_at IS NULL
        WHERE u.user_type = vendor AND u.deleted_at IS NULL
      `;

      const params = [USER_TYPES.VENDOR];
      let paramCount = 1;

      if (status) {
        paramCount++;
        query += ` AND vs.verification_status = $${paramCount}`;
        params.push(status);
      }

      if (search) {
        paramCount++;
        query += ` AND (vs.shop_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.phone_number ILIKE $${paramCount} OR u.name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered`;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      query += ` ORDER BY vs.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      return sendSuccessResponse(res, {
        vendors: result.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }, 'Vendors retrieved successfully');
    } catch (error) {
      console.error('Error fetching vendors:', error);
      return sendErrorResponse(res, 'Failed to fetch vendors', 500);
    }
  }

  // Get vendor details with shop and services
  async getVendorDetails(req, res) {
    try {
      const { vendorId } = req.params;

      // Get vendor details
      const vendorQuery = `
        SELECT 
          u.user_id,
          u.name,
          u.email,
          u.phone_number,
          u.user_type,
          u.status as user_status,
          u.city,
          u.state,
          u.gender,
          u.profile_picture,
          u.phone_verified,
          u.created_at,
          vs.shop_id,
          vs.shop_name,
          vs.shop_address,
          vs.latitude,
          vs.longitude,
          vs.open_time,
          vs.close_time,
          vs.break_start_time,
          vs.break_end_time,
          vs.weekly_holiday,
          vs.no_of_seats,
          vs.no_of_workers,
          vs.verification_status,
          vs.business_license,
          vs.tax_number,
          vs.bank_account_number,
          vs.bank_ifsc_code,
          vs.average_rating,
          vs.total_reviews,
          vs.total_bookings,
          vs.total_revenue,
          vs.verified_at,
          vs.admin_comments
        FROM users u
        INNER JOIN vendor_shops vs ON u.user_id = vs.user_id
        WHERE u.user_id = $1 AND u.deleted_at IS NULL AND vs.deleted_at IS NULL
      `;

      const vendorResult = await db.query(vendorQuery, [vendorId]);

      if (vendorResult.rows.length === 0) {
        return sendErrorResponse(res, 'Vendor not found', 404);
      }

      const shopId = vendorResult.rows[0].shop_id;

      // Get vendor services
      const servicesQuery = `
        SELECT 
          vserv.vendor_service_id,
          vserv.service_id,
          vserv.price,
          vserv.is_available,
          vserv.created_at,
          sm.service_name,
          sm.service_description,
          sm.default_duration_minutes,
          sm.service_type
        FROM vendor_services vserv
        INNER JOIN services_master sm ON vserv.service_id = sm.service_id
        WHERE vserv.vendor_id = $1 AND vserv.deleted_at IS NULL
        ORDER BY vserv.created_at DESC
      `;

      const servicesResult = await db.query(servicesQuery, [vendorId]);

      // Get vendor images
      const imagesQuery = `
        SELECT 
          image_id,
          image_url,
          image_type,
          is_primary,
          created_at
        FROM vendor_images
        WHERE vendor_id = $1 AND deleted_at IS NULL
        ORDER BY is_primary DESC, created_at DESC
      `;

      const imagesResult = await db.query(imagesQuery, [vendorId]);

      // Get verification documents
      const docsQuery = `
        SELECT 
          document_id,
          document_type,
          document_url,
          verification_status,
          admin_comments,
          created_at
        FROM verification_documents
        WHERE vendor_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;

      const docsResult = await db.query(docsQuery, [vendorId]);

      return sendSuccessResponse(res, {
        vendor: vendorResult.rows[0],
        services: servicesResult.rows,
        images: imagesResult.rows,
        documents: docsResult.rows
      }, 'Vendor details retrieved successfully');
    } catch (error) {
      console.error('Error fetching vendor details:', error);
      return sendErrorResponse(res, 'Failed to fetch vendor details', 500);
    }
  }

  // Approve vendor
  async approveVendor(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { vendorId } = req.params;
      const adminId = req.user.user_id;

      const updateQuery = `
        UPDATE vendor_shops 
        SET 
          verification_status = 'approved',
          verified_at = CURRENT_TIMESTAMP,
          verified_by = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await client.query(updateQuery, [adminId, vendorId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'Vendor not found', 404);
      }

      // Update user status to active
      await client.query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        ['active', vendorId]
      );

      // TODO: Send notification to vendor

      await client.query('COMMIT');
      return sendSuccessResponse(res, result.rows[0], 'Vendor approved successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error approving vendor:', error);
      return sendErrorResponse(res, 'Failed to approve vendor', 500);
    } finally {
      client.release();
    }
  }

  // Reject vendor
  async rejectVendor(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { vendorId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.user_id;

      if (!reason) {
        return sendErrorResponse(res, 'Rejection reason is required', 400);
      }

      const updateQuery = `
        UPDATE vendor_shops 
        SET 
          verification_status = 'rejected',
          admin_comments = $1,
          verified_by = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await client.query(updateQuery, [reason, adminId, vendorId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'Vendor not found', 404);
      }

      // Update user status to suspended
      await client.query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        ['suspended', vendorId]
      );

      // TODO: Send notification to vendor with reason

      await client.query('COMMIT');
      return sendSuccessResponse(res, result.rows[0], 'Vendor rejected successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error rejecting vendor:', error);
      return sendErrorResponse(res, 'Failed to reject vendor', 500);
    } finally {
      client.release();
    }
  }

  // Suspend vendor
  async suspendVendor(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { vendorId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return sendErrorResponse(res, 'Suspension reason is required', 400);
      }

      // Update user status
      const result = await client.query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND deleted_at IS NULL RETURNING *',
        ['suspended', vendorId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'Vendor not found', 404);
      }

      // Update shop admin comments
      await client.query(
        'UPDATE vendor_shops SET admin_comments = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [reason, vendorId]
      );

      // TODO: Send notification to vendor

      await client.query('COMMIT');
      return sendSuccessResponse(res, result.rows[0], 'Vendor suspended successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error suspending vendor:', error);
      return sendErrorResponse(res, 'Failed to suspend vendor', 500);
    } finally {
      client.release();
    }
  }

  // Activate vendor
  async activateVendor(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { vendorId } = req.params;

      // Update user status
      const result = await client.query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND deleted_at IS NULL RETURNING *',
        ['active', vendorId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'Vendor not found', 404);
      }

      await client.query('COMMIT');
      return sendSuccessResponse(res, result.rows[0], 'Vendor activated successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error activating vendor:', error);
      return sendErrorResponse(res, 'Failed to activate vendor', 500);
    } finally {
      client.release();
    }
  }
}

module.exports = new VendorAdminController();