// src/controllers/admin/banner.admin.controller.js

const db = require('../../config/database');
const { sendSuccessResponse, sendErrorResponse } = require('../../utils/helpers/response.helper');

class BannerAdminController {
  // Create banner
  async createBanner(req, res) {
    try {
      const {
        title,
        description,
        banner_type,
        image_url,
        redirect_url,
        target_entity_type,
        target_entity_id,
        start_date,
        end_date,
        display_order
      } = req.body;

      const query = `
        INSERT INTO home_banners (
          title, description, banner_type, image_url, redirect_url,
          target_entity_type, target_entity_id, start_date, end_date,
          display_order, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const result = await db.query(query, [
        title,
        description,
        banner_type,
        image_url,
        redirect_url,
        target_entity_type,
        target_entity_id,
        start_date,
        end_date,
        display_order || 0,
        true
      ]);

      return sendSuccessResponse(res, result.rows[0], 'Banner created successfully', 201);
    } catch (error) {
      console.error('Error creating banner:', error);
      return sendErrorResponse(res, 'Failed to create banner', 500);
    }
  }

  // Get all banners
  async getAllBanners(req, res) {
    try {
      const { page = 1, limit = 10, is_active, banner_type } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          hb.*,
          CASE 
            WHEN hb.target_entity_type = 'shop' THEN (
              SELECT shop_name FROM vendor_shops WHERE shop_id = hb.target_entity_id
            )
            WHEN hb.target_entity_type = 'vendor' THEN (
              SELECT business_name FROM vendors WHERE vendor_id = hb.target_entity_id
            )
            WHEN hb.target_entity_type = 'service' THEN (
              SELECT service_name FROM services_master WHERE service_id = hb.target_entity_id
            )
            ELSE NULL
          END as target_name
        FROM home_banners hb
        WHERE hb.deleted_at IS NULL
      `;

      const params = [];
      let paramCount = 0;

      if (is_active !== undefined) {
        paramCount++;
        query += ` AND hb.is_active = $${paramCount}`;
        params.push(is_active === 'true');
      }

      if (banner_type) {
        paramCount++;
        query += ` AND hb.banner_type = $${paramCount}`;
        params.push(banner_type);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered`;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      query += ` ORDER BY hb.display_order ASC, hb.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      return sendSuccessResponse(res, {
        banners: result.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }, 'Banners retrieved successfully');
    } catch (error) {
      console.error('Error fetching banners:', error);
      return sendErrorResponse(res, 'Failed to fetch banners', 500);
    }
  }

  // Get active banners (for homepage)
  async getActiveBanners(req, res) {
    try {
      const { banner_type } = req.query;

      let query = `
        SELECT *
        FROM home_banners
        WHERE is_active = true 
          AND deleted_at IS NULL
          AND (start_date IS NULL OR start_date <= CURRENT_DATE)
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      `;

      const params = [];

      if (banner_type) {
        query += ` AND banner_type = $1`;
        params.push(banner_type);
      }

      query += ` ORDER BY display_order ASC, created_at DESC`;

      const result = await db.query(query, params);

      return sendSuccessResponse(res, result.rows, 'Active banners retrieved successfully');
    } catch (error) {
      console.error('Error fetching active banners:', error);
      return sendErrorResponse(res, 'Failed to fetch active banners', 500);
    }
  }

  // Get banner details
  async getBannerDetails(req, res) {
    try {
      const { bannerId } = req.params;

      const query = `
        SELECT *
        FROM home_banners
        WHERE banner_id = $1 AND deleted_at IS NULL
      `;

      const result = await db.query(query, [bannerId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Banner not found', 404);
      }

      return sendSuccessResponse(res, result.rows[0], 'Banner details retrieved successfully');
    } catch (error) {
      console.error('Error fetching banner details:', error);
      return sendErrorResponse(res, 'Failed to fetch banner details', 500);
    }
  }

  // Update banner
  async updateBanner(req, res) {
    try {
      const { bannerId } = req.params;
      const {
        title,
        description,
        banner_type,
        image_url,
        redirect_url,
        target_entity_type,
        target_entity_id,
        start_date,
        end_date,
        display_order,
        is_active
      } = req.body;

      const updateFields = [];
      const values = [];
      let paramCount = 0;

      if (title !== undefined) {
        paramCount++;
        updateFields.push(`title = $${paramCount}`);
        values.push(title);
      }
      if (description !== undefined) {
        paramCount++;
        updateFields.push(`description = $${paramCount}`);
        values.push(description);
      }
      if (banner_type !== undefined) {
        paramCount++;
        updateFields.push(`banner_type = $${paramCount}`);
        values.push(banner_type);
      }
      if (image_url !== undefined) {
        paramCount++;
        updateFields.push(`image_url = $${paramCount}`);
        values.push(image_url);
      }
      if (redirect_url !== undefined) {
        paramCount++;
        updateFields.push(`redirect_url = $${paramCount}`);
        values.push(redirect_url);
      }
      if (target_entity_type !== undefined) {
        paramCount++;
        updateFields.push(`target_entity_type = $${paramCount}`);
        values.push(target_entity_type);
      }
      if (target_entity_id !== undefined) {
        paramCount++;
        updateFields.push(`target_entity_id = $${paramCount}`);
        values.push(target_entity_id);
      }
      if (start_date !== undefined) {
        paramCount++;
        updateFields.push(`start_date = $${paramCount}`);
        values.push(start_date);
      }
      if (end_date !== undefined) {
        paramCount++;
        updateFields.push(`end_date = $${paramCount}`);
        values.push(end_date);
      }
      if (display_order !== undefined) {
        paramCount++;
        updateFields.push(`display_order = $${paramCount}`);
        values.push(display_order);
      }
      if (is_active !== undefined) {
        paramCount++;
        updateFields.push(`is_active = $${paramCount}`);
        values.push(is_active);
      }

      if (updateFields.length === 0) {
        return sendErrorResponse(res, 'No fields to update', 400);
      }

      paramCount++;
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(bannerId);

      const query = `
        UPDATE home_banners 
        SET ${updateFields.join(', ')}
        WHERE banner_id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Banner not found', 404);
      }

      return sendSuccessResponse(res, result.rows[0], 'Banner updated successfully');
    } catch (error) {
      console.error('Error updating banner:', error);
      return sendErrorResponse(res, 'Failed to update banner', 500);
    }
  }

  // Delete banner
  async deleteBanner(req, res) {
    try {
      const { bannerId } = req.params;

      const query = `
        UPDATE home_banners 
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE banner_id = $1 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await db.query(query, [bannerId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Banner not found', 404);
      }

      return sendSuccessResponse(res, null, 'Banner deleted successfully');
    } catch (error) {
      console.error('Error deleting banner:', error);
      return sendErrorResponse(res, 'Failed to delete banner', 500);
    }
  }

  // Update banner status
  async updateBannerStatus(req, res) {
    try {
      const { bannerId } = req.params;
      const { is_active } = req.body;

      if (is_active === undefined) {
        return sendErrorResponse(res, 'is_active field is required', 400);
      }

      const query = `
        UPDATE home_banners 
        SET is_active = $1, updated_at = CURRENT_TIMESTAMP
        WHERE banner_id = $2 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await db.query(query, [is_active, bannerId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'Banner not found', 404);
      }

      return sendSuccessResponse(res, result.rows[0], 'Banner status updated successfully');
    } catch (error) {
      console.error('Error updating banner status:', error);
      return sendErrorResponse(res, 'Failed to update banner status', 500);
    }
  }

  // Reorder banners
  async reorderBanners(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { banners } = req.body; // Array of { banner_id, display_order }

      if (!Array.isArray(banners) || banners.length === 0) {
        return sendErrorResponse(res, 'Invalid banners array', 400);
      }

      for (const banner of banners) {
        await client.query(
          'UPDATE home_banners SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE banner_id = $2',
          [banner.display_order, banner.banner_id]
        );
      }

      await client.query('COMMIT');
      return sendSuccessResponse(res, null, 'Banners reordered successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error reordering banners:', error);
      return sendErrorResponse(res, 'Failed to reorder banners', 500);
    } finally {
      client.release();
    }
  }
}

module.exports = new BannerAdminController();