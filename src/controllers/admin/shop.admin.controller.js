// src/controllers/admin/shop.admin.controller.js

const db = require('../../config/database');
const { sendSuccessResponse, sendErrorResponse } = require('../../utils/helpers/response.helper');

class ShopAdminController {
  // Create shop
  async createShop(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const {
        vendor_id,
        shop_name,
        shop_address,
        city,
        state,
        latitude,
        longitude,
        open_time,
        close_time,
        weekly_holiday
      } = req.body;

      // Verify vendor exists
      const vendorCheck = await client.query(
        'SELECT * FROM vendors WHERE vendor_id = $1 AND deleted_at IS NULL',
        [vendor_id]
      );

      if (vendorCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'Vendor not found', 404);
      }

      const query = `
        INSERT INTO vendor_shops (
          vendor_id, shop_name, shop_address, city, state,
          latitude, longitude, open_time, close_time, weekly_holiday, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const result = await client.query(query, [
        vendor_id,
        shop_name,
        shop_address,
        city,
        state,
        latitude,
        longitude,
        open_time,
        close_time,
        weekly_holiday || 'weekly_holiday',
        'active'
      ]);

      await client.query('COMMIT');
      return sendSuccessResponse(res, result.rows[0], 'Shop created successfully', 201);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating shop:', error);
      return sendErrorResponse(res, 'Failed to create shop', 500);
    } finally {
      client.release();
    }
  }

  // Get all shops
  async getAllShops(req, res) {
    try {
      const { page = 1, limit = 10, status, vendor_id, city, search } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          vs.shop_id,
          vs.shop_name,
          vs.shop_address,
          vs.city,
          vs.state,
          vs.latitude,
          vs.longitude,
          vs.open_time,
          vs.close_time,
          vs.weekly_holiday,
          vs.status,
          vs.created_at,
          v.vendor_id,
          v.business_name,
          u.email as vendor_email,
          u.phone_number as vendor_phone,
          (SELECT COUNT(*) FROM vendor_services WHERE shop_id = vs.shop_id AND deleted_at IS NULL) as total_services,
          (SELECT COUNT(*) FROM bookings WHERE shop_id = vs.shop_id AND deleted_at IS NULL) as total_bookings
        FROM vendor_shops vs
        INNER JOIN vendors v ON vs.vendor_id = v.vendor_id
        INNER JOIN users u ON v.user_id = u.user_id
        WHERE vs.deleted_at IS NULL
      `;

      const params = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        query += ` AND vs.status = $${paramCount}`;
        params.push(status);
      }

      if (vendor_id) {
        paramCount++;
        query += ` AND vs.vendor_id = $${paramCount}`;
        params.push(vendor_id);
      }

      if (city) {
        paramCount++;
        query += ` AND vs.city ILIKE $${paramCount}`;
        params.push(`%${city}%`);
      }

      if (search) {
        paramCount++;
        query += ` AND (vs.shop_name ILIKE $${paramCount} OR vs.shop_address ILIKE $${paramCount} OR v.business_name ILIKE $${paramCount})`;
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
        shops: result.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }, 'Shops retrieved successfully');
    } catch (error) {
      console.error('Error fetching shops:', error);
      return sendErrorResponse(res, 'Failed to fetch shops', 500);
    }
  }

  // Get shop details
  async getShopDetails(req, res) {
    try {
      const { shopId } = req.params;

      const query = `
        SELECT 
          vs.*,
          v.vendor_id,
          v.business_name,
          v.business_license,
          u.email as vendor_email,
          u.phone_number as vendor_phone
        FROM vendor_shops vs
        INNER JOIN vendors v ON vs.vendor_id = v.vendor_id
        INNER JOIN users u ON v.user_id = u.user_id
        WHERE vs.shop_id = $1 AND vs.deleted_at IS NULL
      `;

      const result = await db.query(query, [shopId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Shop not found', 404);
      }

      // Get shop services
      const servicesQuery = `
        SELECT 
          vsvc.service_id,
          vsvc.service_name,
          vsvc.price,
          vsvc.is_available,
          sm.service_name as master_service_name,
          sm.category
        FROM vendor_services vsvc
        LEFT JOIN services_master sm ON vsvc.master_service_id = sm.service_id
        WHERE vsvc.shop_id = $1 AND vsvc.deleted_at IS NULL
      `;

      const servicesResult = await db.query(servicesQuery, [shopId]);

      // Get shop images
      const imagesQuery = `
        SELECT image_id, image_url, image_type
        FROM vendor_images
        WHERE shop_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;

      const imagesResult = await db.query(imagesQuery, [shopId]);

      return sendSuccessResponse(res, {
        shop: result.rows[0],
        services: servicesResult.rows,
        images: imagesResult.rows
      }, 'Shop details retrieved successfully');
    } catch (error) {
      console.error('Error fetching shop details:', error);
      return sendErrorResponse(res, 'Failed to fetch shop details', 500);
    }
  }

  // Update shop
  async updateShop(req, res) {
    try {
      const { shopId } = req.params;
      const {
        shop_name,
        shop_address,
        city,
        state,
        latitude,
        longitude,
        open_time,
        close_time,
        weekly_holiday,
        status
      } = req.body;

      const updateFields = [];
      const values = [];
      let paramCount = 0;

      if (shop_name !== undefined) {
        paramCount++;
        updateFields.push(`shop_name = $${paramCount}`);
        values.push(shop_name);
      }
      if (shop_address !== undefined) {
        paramCount++;
        updateFields.push(`shop_address = $${paramCount}`);
        values.push(shop_address);
      }
      if (city !== undefined) {
        paramCount++;
        updateFields.push(`city = $${paramCount}`);
        values.push(city);
      }
      if (state !== undefined) {
        paramCount++;
        updateFields.push(`state = $${paramCount}`);
        values.push(state);
      }
      if (latitude !== undefined) {
        paramCount++;
        updateFields.push(`latitude = $${paramCount}`);
        values.push(latitude);
      }
      if (longitude !== undefined) {
        paramCount++;
        updateFields.push(`longitude = $${paramCount}`);
        values.push(longitude);
      }
      if (open_time !== undefined) {
        paramCount++;
        updateFields.push(`open_time = $${paramCount}`);
        values.push(open_time);
      }
      if (close_time !== undefined) {
        paramCount++;
        updateFields.push(`close_time = $${paramCount}`);
        values.push(close_time);
      }
      if (weekly_holiday !== undefined) {
        paramCount++;
        updateFields.push(`weekly_holiday = $${paramCount}`);
        values.push(weekly_holiday);
      }
      if (status !== undefined) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        values.push(status);
      }

      if (updateFields.length === 0) {
        return sendErrorResponse(res, 'No fields to update', 400);
      }

      paramCount++;
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(shopId);

      const query = `
        UPDATE vendor_shops 
        SET ${updateFields.join(', ')}
        WHERE shop_id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Shop not found', 404);
      }

      return sendSuccessResponse(res, result.rows[0], 'Shop updated successfully');
    } catch (error) {
      console.error('Error updating shop:', error);
      return sendErrorResponse(res, 'Failed to update shop', 500);
    }
  }

  // Delete shop
  async deleteShop(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { shopId } = req.params;

      // Soft delete shop
      const result = await client.query(
        'UPDATE vendor_shops SET deleted_at = CURRENT_TIMESTAMP WHERE shop_id = $1 AND deleted_at IS NULL RETURNING *',
        [shopId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'Shop not found', 404);
      }

      // Soft delete related services
      await client.query(
        'UPDATE vendor_services SET deleted_at = CURRENT_TIMESTAMP WHERE shop_id = $1',
        [shopId]
      );

      await client.query('COMMIT');
      return sendSuccessResponse(res, null, 'Shop deleted successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting shop:', error);
      return sendErrorResponse(res, 'Failed to delete shop', 500);
    } finally {
      client.release();
    }
  }

  // Update shop status
  async updateShopStatus(req, res) {
    try {
      const { shopId } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive', 'temporarily_closed'].includes(status)) {
        return sendErrorResponse(res, 'Invalid status', 400);
      }

      const query = `
        UPDATE vendor_shops 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $2 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await db.query(query, [status, shopId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Shop not found', 404);
      }

      return sendSuccessResponse(res, result.rows[0], 'Shop status updated successfully');
    } catch (error) {
      console.error('Error updating shop status:', error);
      return sendErrorResponse(res, 'Failed to update shop status', 500);
    }
  }
}

module.exports = new ShopAdminController();