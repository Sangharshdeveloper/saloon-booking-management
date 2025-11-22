// src/controllers/admin/user.admin.controller.js

const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const { sendSuccessResponse, sendErrorResponse } = require('../../utils/helpers/response.helper');
const { USER_TYPES } = require('../../constants');

class UserAdminController {
  // Create customer
  async createCustomer(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const {
        name,
        phone_number,
        email,
        password,
        city,
        state,
        gender
      } = req.body;

      // Check if user exists
      const checkQuery = "SELECT * FROM users WHERE phone_number = $1 AND status != 'deleted'";
      const existing = await client.query(checkQuery, [phone_number]);

      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'User with this phone number already exists', 400);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userQuery = `
        INSERT INTO users (
          name, phone_number, email, password_hash, user_type, 
          city, state, gender, status, phone_verified
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const userResult = await client.query(userQuery, [
        name,
        phone_number,
        email,
        hashedPassword,
        USER_TYPES.CUSTOMER,
        city,
        state,
        gender,
        'active',
        true
      ]);

      await client.query('COMMIT');

      return sendSuccessResponse(res, userResult.rows[0], 'Customer created successfully', 201);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating customer:', error);
      return sendErrorResponse(res, 'Failed to create customer', 500);
    } finally {
      client.release();
    }
  }

  // Create vendor
  async createVendor(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const {
        name,
        phone_number,
        email,
        password,
        city,
        state,
        shop_name,
        shop_address,
        latitude,
        longitude,
        open_time,
        close_time,
        weekly_holiday,
        no_of_seats,
        no_of_workers,
        business_license,
        tax_number,
        bank_account_number,
        bank_ifsc_code
      } = req.body;

      // Check if user exists
      const checkQuery = "SELECT * FROM users WHERE phone_number = $1 AND status != 'deleted'";
      const existing = await client.query(checkQuery, [phone_number]);

      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'User with this phone number already exists', 400);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userQuery = `
        INSERT INTO users (
          name, phone_number, email, password_hash, user_type, 
          city, state, status, phone_verified
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const userResult = await client.query(userQuery, [
        name,
        phone_number,
        email,
        hashedPassword,
        USER_TYPES.VENDOR,
        city,
        state,
        'active',
        true
      ]);

      const userId = userResult.rows[0].user_id;

      // Create vendor shop
      const shopQuery = `
        INSERT INTO vendor_shops (
          user_id, shop_name, shop_address, city, state,
          latitude, longitude, open_time, close_time, 
          weekly_holiday, no_of_seats, no_of_workers,
          business_license, tax_number, bank_account_number, 
          bank_ifsc_code, verification_status, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `;

      const shopResult = await client.query(shopQuery, [
        userId,
        shop_name,
        shop_address,
        city,
        state,
        latitude,
        longitude,
        open_time,
        close_time,
        weekly_holiday || 'sunday',
        no_of_seats || 1,
        no_of_workers || 1,
        business_license,
        tax_number,
        bank_account_number,
        bank_ifsc_code,
        'approved', // Admin created, so auto-approved
        'active'
      ]);

      await client.query('COMMIT');

      return sendSuccessResponse(res, {
        user: userResult.rows[0],
        shop: shopResult.rows[0]
      }, 'Vendor created successfully', 201);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating vendor:', error);
      return sendErrorResponse(res, 'Failed to create vendor', 500);
    } finally {
      client.release();
    }
  }

  // Get all customers
  async getAllCustomers(req, res) {
    try {
      const { page = 1, limit = 10, status, search } = req.query;
      const offset = (page - 1) * limit;

      let baseQuery = `
        FROM users u
        WHERE u.user_type = customer
      `;

      const params = [USER_TYPES.CUSTOMER];
      let paramCount = 1;

      if (status) {
        paramCount++;
        baseQuery += ` AND u.status = ${paramCount}`;
        params.push(status);
      }

      if (search) {
        paramCount++;
        baseQuery += ` AND (u.email ILIKE ${paramCount} OR u.phone_number ILIKE ${paramCount} OR u.name ILIKE ${paramCount})`;
        params.push(`%${search}%`);
      }

      // Get total count with same parameters
      const countQuery = `SELECT COUNT(*) ${baseQuery}`;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const dataQuery = `
        SELECT 
          u.user_id,
          u.name,
          u.email,
          u.phone_number,
          u.user_type,
          u.status,
          u.city,
          u.state,
          u.gender,
          u.profile_picture,
          u.phone_verified,
          u.created_at,
          (SELECT COUNT(*) FROM bookings WHERE user_id = u.user_id AND status != 'deleted') as total_bookings
        ${baseQuery}
        ORDER BY u.created_at DESC 
        LIMIT ${paramCount + 1} OFFSET ${paramCount + 2}
      `;
      
      const result = await db.query(dataQuery, [...params, limit, offset]);

      return sendSuccessResponse(res, {
        customers: result.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }, 'Customers retrieved successfully');
    } catch (error) {
      console.error('Error fetching customers:', error);
      return sendErrorResponse(res, 'Failed to fetch customers', 500);
    }
  }

  // Get user details
  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      const query = `
        SELECT 
          u.user_id,
          u.name,
          u.email,
          u.phone_number,
          u.user_type,
          u.status,
          u.city,
          u.state,
          u.gender,
          u.profile_picture,
          u.phone_verified,
          u.device_id,
          u.last_login_at,
          u.created_at
        FROM users u
        WHERE u.user_id = $1 
      `;

      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Get booking history
      const bookingsQuery = `
        SELECT 
          b.booking_id,
          b.booking_date,
          b.total_amount,
          b.booking_status,
          b.payment_status,
          b.created_at,
          vs.shop_name,
          u2.name as vendor_name
        FROM bookings b
        LEFT JOIN vendor_shops vs ON b.vendor_id = vs.user_id
        LEFT JOIN users u2 ON b.vendor_id = u2.user_id
        WHERE b.user_id = $1 AND b.status != 'deleted'
        ORDER BY b.created_at DESC
        LIMIT 10
      `;

      const bookingsResult = await db.query(bookingsQuery, [userId]);

      return sendSuccessResponse(res, {
        user: result.rows[0],
        recent_bookings: bookingsResult.rows
      }, 'User details retrieved successfully');
    } catch (error) {
      console.error('Error fetching user details:', error);
      return sendErrorResponse(res, 'Failed to fetch user details', 500);
    }
  }

  // Update user status
  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive', 'suspended', 'deleted'].includes(status)) {
        return sendErrorResponse(res, 'Invalid status', 400);
      }

      const query = `
        UPDATE users 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2 AND status != 'deleted'
        RETURNING *
      `;

      const result = await db.query(query, [status, userId]);

      if (result.rows.length === 0) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      return sendSuccessResponse(res, result.rows[0], 'User status updated successfully');
    } catch (error) {
      console.error('Error updating user status:', error);
      return sendErrorResponse(res, 'Failed to update user status', 500);
    }
  }

  // Delete user (status-based delete)
  async deleteUser(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { userId } = req.params;

      // Update user status to deleted
      const result = await client.query(
        "UPDATE users SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status != 'deleted' RETURNING *",
        [userId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendErrorResponse(res, 'User not found', 404);
      }

      // If vendor, update vendor shop status
      if (result.rows[0].user_type === USER_TYPES.VENDOR) {
        await client.query(
          "UPDATE vendor_shops SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
          [userId]
        );
      }

      await client.query('COMMIT');
      return sendSuccessResponse(res, null, 'User deleted successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting user:', error);
      return sendErrorResponse(res, 'Failed to delete user', 500);
    } finally {
      client.release();
    }
  }
}

module.exports = new UserAdminController();