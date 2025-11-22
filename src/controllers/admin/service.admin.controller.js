// src/controllers/admin/service.admin.controller.js

const db = require('../../config/database');
const { sendSuccessResponse, sendErrorResponse } = require('../../utils/helpers/response.helper');

class ServiceAdminController {
  // Create master service
  async createMasterService(req, res) {
    try {
      const { service_name, service_description, default_duration_minutes, service_type } = req.body;

      const query = `
        INSERT INTO services_master (
          service_name, service_description, default_duration_minutes, service_type
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await db.query(query, [
        service_name,
        service_description,
        default_duration_minutes || 30,
        service_type || 'normal'
      ]);

      return sendSuccessResponse(res, result.rows[0], 'Master service created successfully', 201);
    } catch (error) {
      console.error('Error creating master service:', error);
      if (error.constraint === 'services_master_service_name_key') {
        return sendErrorResponse(res, 'Service with this name already exists', 400);
      }
      return sendErrorResponse(res, 'Failed to create master service', 500);
    }
  }

  // Get all master services
  async getAllMasterServices(req, res) {
    try {
      const { service_type, search } = req.query;

      let query = `
        SELECT 
          sm.*,
          (SELECT COUNT(*) FROM vendor_services WHERE service_id = sm.service_id AND status != 'deleted') as usage_count
        FROM services_master sm
        WHERE sm.status != 'deleted'
      `;

      const params = [];
      let paramCount = 0;

      if (service_type) {
        paramCount++;
        query += ` AND sm.service_type = $${paramCount}`;
        params.push(service_type);
      }

      if (search) {
        paramCount++;
        query += ` AND (sm.service_name ILIKE $${paramCount} OR sm.service_description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY sm.service_name ASC`;

      const result = await db.query(query, params);
      return sendSuccessResponse(res, result.rows, 'Master services retrieved successfully');
    } catch (error) {
      console.error('Error fetching master services:', error);
      return sendErrorResponse(res, 'Failed to fetch master services', 500);
    }
  }

  // Update master service
  async updateMasterService(req, res) {
    try {
      const { serviceId } = req.params;
      const { service_name, service_description, default_duration_minutes, service_type } = req.body;

      const updateFields = [];
      const values = [];
      let paramCount = 0;

      if (service_name !== undefined) {
        paramCount++;
        updateFields.push(`service_name = $${paramCount}`);
        values.push(service_name);
      }
      if (service_description !== undefined) {
        paramCount++;
        updateFields.push(`service_description = $${paramCount}`);
        values.push(service_description);
      }
      if (default_duration_minutes !== undefined) {
        paramCount++;
        updateFields.push(`default_duration_minutes = $${paramCount}`);
        values.push(default_duration_minutes);
      }
      if (service_type !== undefined) {
        paramCount++;
        updateFields.push(`service_type = $${paramCount}`);
        values.push(service_type);
      }

      if (updateFields.length === 0) {
        return sendErrorResponse(res, 'No fields to update', 400);
      }

      paramCount++;
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(serviceId);

      const query = `
        UPDATE services_master 
        SET ${updateFields.join(', ')}
        WHERE service_id = $${paramCount} AND status != 'deleted'
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Master service not found', 404);
      }

      return sendSuccessResponse(res, result.rows[0], 'Master service updated successfully');
    } catch (error) {
      console.error('Error updating master service:', error);
      if (error.constraint === 'services_master_service_name_key') {
        return sendErrorResponse(res, 'Service with this name already exists', 400);
      }
      return sendErrorResponse(res, 'Failed to update master service', 500);
    }
  }

  // Delete master service
  async deleteMasterService(req, res) {
    try {
      const { serviceId } = req.params;

      // Check if service is being used
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM vendor_services 
        WHERE service_id = $1 AND status != 'deleted'
      `;

      const checkResult = await db.query(checkQuery, [serviceId]);

      if (parseInt(checkResult.rows[0].count) > 0) {
        return sendErrorResponse(res, 'Cannot delete service that is being used by vendors', 400);
      }

      const query = `
        UPDATE services_master 
        SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
        WHERE service_id = $1 AND status != 'deleted'
        RETURNING *
      `;

      const result = await db.query(query, [serviceId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Master service not found', 404);
      }

      return sendSuccessResponse(res, null, 'Master service deleted successfully');
    } catch (error) {
      console.error('Error deleting master service:', error);
      return sendErrorResponse(res, 'Failed to delete master service', 500);
    }
  }

  // Create vendor service
  async createVendorService(req, res) {
    try {
      const {
        vendor_id,
        service_id,
        price
      } = req.body;

      // Verify vendor exists
      const vendorCheck = await db.query(
        "SELECT * FROM users WHERE user_id = $1 AND user_type = $2 AND status != 'deleted'",
        [vendor_id, 'vendor']
      );

      if (vendorCheck.rows.length === 0) {
        return sendErrorResponse(res, 'Vendor not found', 404);
      }

      // Verify service exists
      const serviceCheck = await db.query(
        "SELECT * FROM services_master WHERE service_id = $1 AND status != 'deleted'",
        [service_id]
      );

      if (serviceCheck.rows.length === 0) {
        return sendErrorResponse(res, 'Service not found', 404);
      }

      const query = `
        INSERT INTO vendor_services (
          vendor_id, service_id, price, is_available
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await db.query(query, [
        vendor_id,
        service_id,
        price,
        true
      ]);

      return sendSuccessResponse(res, result.rows[0], 'Vendor service created successfully', 201);
    } catch (error) {
      console.error('Error creating vendor service:', error);
      return sendErrorResponse(res, 'Failed to create vendor service', 500);
    }
  }

  // Get all vendor services
  async getAllVendorServices(req, res) {
    try {
      const { page = 1, limit = 10, vendor_id, is_available } = req.query;
      const offset = (page - 1) * limit;

      let baseQuery = `
        FROM vendor_services vserv
        INNER JOIN users u ON vserv.vendor_id = u.user_id
        INNER JOIN vendor_shops vs ON vserv.vendor_id = vs.user_id
        INNER JOIN services_master sm ON vserv.service_id = sm.service_id
        WHERE vserv.status != 'deleted'
      `;

      const params = [];
      let paramCount = 0;

      if (vendor_id) {
        paramCount++;
        baseQuery += ` AND vserv.vendor_id = ${paramCount}`;
        params.push(vendor_id);
      }

      if (is_available !== undefined) {
        paramCount++;
        baseQuery += ` AND vserv.is_available = ${paramCount}`;
        params.push(is_available === 'true');
      }

      // Get total count with same parameters
      const countQuery = `SELECT COUNT(*) ${baseQuery}`;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const dataQuery = `
        SELECT 
          vserv.vendor_service_id,
          vserv.vendor_id,
          vserv.service_id,
          vserv.price,
          vserv.is_available,
          vserv.created_at,
          u.name as vendor_name,
          u.email as vendor_email,
          vs.shop_name,
          sm.service_name,
          sm.service_description,
          sm.default_duration_minutes,
          sm.service_type
        ${baseQuery}
        ORDER BY vserv.created_at DESC 
        LIMIT ${paramCount + 1} OFFSET ${paramCount + 2}
      `;

      const result = await db.query(dataQuery, [...params, limit, offset]);

      return sendSuccessResponse(res, {
        services: result.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }, 'Vendor services retrieved successfully');
    } catch (error) {
      console.error('Error fetching vendor services:', error);
      return sendErrorResponse(res, 'Failed to fetch vendor services', 500);
    }
  }

  // Update vendor service
  async updateVendorService(req, res) {
    try {
      const { serviceId } = req.params;
      const { price, is_available } = req.body;

      const updateFields = [];
      const values = [];
      let paramCount = 0;

      if (price !== undefined) {
        paramCount++;
        updateFields.push(`price = $${paramCount}`);
        values.push(price);
      }
      if (is_available !== undefined) {
        paramCount++;
        updateFields.push(`is_available = $${paramCount}`);
        values.push(is_available);
      }

      if (updateFields.length === 0) {
        return sendErrorResponse(res, 'No fields to update', 400);
      }

      paramCount++;
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(serviceId);

      const query = `
        UPDATE vendor_services 
        SET ${updateFields.join(', ')}
        WHERE vendor_service_id = $${paramCount} AND status != 'deleted'
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Vendor service not found', 404);
      }

      return sendSuccessResponse(res, result.rows[0], 'Vendor service updated successfully');
    } catch (error) {
      console.error('Error updating vendor service:', error);
      return sendErrorResponse(res, 'Failed to update vendor service', 500);
    }
  }

  // Delete vendor service
  async deleteVendorService(req, res) {
    try {
      const { serviceId } = req.params;

      const query = `
        UPDATE vendor_services 
        SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
        WHERE vendor_service_id = $1 AND status != 'deleted'
        RETURNING *
      `;

      const result = await db.query(query, [serviceId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Vendor service not found', 404);
      }

      return sendSuccessResponse(res, null, 'Vendor service deleted successfully');
    } catch (error) {
      console.error('Error deleting vendor service:', error);
      return sendErrorResponse(res, 'Failed to delete vendor service', 500);
    }
  }
}

module.exports = new ServiceAdminController();