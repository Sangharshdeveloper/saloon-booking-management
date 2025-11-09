// src/services/auth.service.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// Assuming these are your Sequelize models
const { User, VendorShop } = require('../models');

// Assuming you have custom error handlers defined in utils/errors
const { 
  NotFoundError, 
  AuthenticationError, 
  ValidationError, 
  ForbiddenError // For unauthorized actions
} = require('../utils/errors'); 

class AuthService {
  
  // --- PRIVATE HELPERS ---
  /**
   * Generates a JWT token for a user.
   * @param {number} user_id 
   * @param {string} user_type 
   * @param {string} role 
   * @returns {string} The JWT token
   */
  _generateToken(user_id, user_type, role) {
    return jwt.sign(
      { user_id, user_type, role },
      process.env.JWT_SECRET || 'your-secret-key-please-change-me',
      { expiresIn: '30d' }
    );
  }

  // --- REGISTRATION ---

  /**
   * Handles customer registration logic.
   * @param {object} userData - Request body data
   * @returns {object} User data and token
   */
  async registerCustomer(userData) {
    const { name, phone_number, email, password, city, state, gender, device_id } = userData;

    // Check if user exists
    const existingUser = await User.findOne({ where: { phone_number } });
    if (existingUser) {
      throw new ValidationError('Phone number already registered');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create customer user
    const user = await User.create({
      name,
      phone_number,
      email,
      password_hash,
      city,
      state,
      gender,
      device_id,
      user_type: 'customer',
      role: 'user',
      status: 'active'
    });

    const token = this._generateToken(user.user_id, 'customer', 'user');

    return {
      user: {
        user_id: user.user_id,
        name: user.name,
        phone_number: user.phone_number,
        email: user.email,
        city: user.city,
        state: user.state,
        gender: user.gender,
        user_type: user.user_type,
        is_verified: user.is_verified
      },
      token
    };
  }

  /**
   * Handles vendor registration and shop creation logic (transactional).
   * @param {object} userData - Request body data
   * @returns {object} User and shop data and token
   */
  async registerVendor(userData) {
    const transaction = await User.sequelize.transaction();
    
    try {
      const {
        name, phone_number, email, password, city, state, 
        shop_name, shop_address, shop_city, shop_state, latitude, longitude,
        open_time, close_time, break_start_time, break_end_time, weekly_holiday,
        no_of_seats, no_of_workers
      } = userData;

      // Check if user exists
      const existingUser = await User.findOne({ where: { phone_number } });
      if (existingUser) {
        throw new ValidationError('Phone number already registered');
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 12);

      // Create vendor user
      const user = await User.create({
        name,
        phone_number,
        email,
        password_hash,
        city: city || shop_city,
        state: state || shop_state,
        user_type: 'vendor',
        role: 'user',
        status: 'active',
        is_verified: false
      }, { transaction });

      // Create vendor shop
      const vendorShop = await VendorShop.create({
        user_id: user.user_id,
        shop_name,
        shop_address,
        city: shop_city || city,
        state: shop_state || state,
        latitude,
        longitude,
        open_time,
        close_time,
        break_start_time,
        break_end_time,
        weekly_holiday,
        no_of_seats: no_of_seats || 1,
        no_of_workers: no_of_workers || 1,
        verification_status: 'pending',
        status: 'active'
      }, { transaction });

      await transaction.commit();

      const token = this._generateToken(user.user_id, 'vendor', 'user');

      return {
        user: {
          user_id: user.user_id,
          name: user.name,
          phone_number: user.phone_number,
          email: user.email,
          user_type: user.user_type,
          is_verified: user.is_verified
        },
        shop: {
          shop_id: vendorShop.shop_id,
          shop_name: vendorShop.shop_name,
          verification_status: vendorShop.verification_status
        },
        token
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // --- LOGIN ---

  /**
   * Handles unified login for Customer/Vendor.
   * @param {object} credentials - phone_number, password, user_type (optional)
   * @returns {object} User data, optional shop data, and token
   */
  async login({ phone_number, password, user_type }) {
    // Find user
    const user = await User.findOne({
      where: { 
        phone_number,
        ...(user_type && { user_type })
      },
      include: user_type === 'vendor' ? [{
        model: VendorShop,
        as: 'vendorShop'
      }] : []
    });

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if account is active
    if (user.status !== 'active') {
      throw new ForbiddenError('Account is not active');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate JWT token
    const token = this._generateToken(user.user_id, user.user_type, user.role);

    // Prepare response data based on user type
    const responseData = {
      user: {
        user_id: user.user_id,
        name: user.name,
        phone_number: user.phone_number,
        email: user.email,
        city: user.city,
        state: user.state,
        gender: user.gender,
        user_type: user.user_type,
        role: user.role,
        is_verified: user.is_verified,
        profile_picture: user.profile_picture
      },
      token
    };

    // Add shop details for vendors
    if (user.user_type === 'vendor' && user.vendorShop) {
      responseData.shop = {
        shop_id: user.vendorShop.shop_id,
        shop_name: user.vendorShop.shop_name,
        shop_address: user.vendorShop.shop_address,
        city: user.vendorShop.city,
        state: user.vendorShop.state,
        verification_status: user.vendorShop.verification_status,
        open_time: user.vendorShop.open_time,
        close_time: user.vendorShop.close_time
      };
    }

    return responseData;
  }

  /**
   * Handles admin-specific login.
   * @param {object} credentials - phone_number, password
   * @returns {object} Admin data and token
   */
  async adminLogin({ email, password }) {
    // Find admin user
    const user = await User.findOne({
      where: { 
        email,
        user_type: 'admin'
      }
    });

    if (!user) {
      throw new AuthenticationError('Invalid admin credentials');
    }

    // Check if account is active
    if (user.status !== 'active') {
      throw new ForbiddenError('Account is not active');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid admin credentials');
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate JWT token
    const token = this._generateToken(user.user_id, 'admin', user.role);

    return {
      admin: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        user_type: user.user_type
      },
      token
    };
  }

  // --- PROFILE MANAGEMENT ---

  /**
   * Fetches user profile data.
   * @param {number} userId 
   * @param {string} userType 
   * @returns {object} User profile data
   */
  async getProfile(userId, userType) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] },
      include: userType === 'vendor' ? [{
        model: VendorShop,
        as: 'vendorShop'
      }] : []
    });

    if (!user) {
      // In the controller, we return a 404 if the result is null. 
      // In the service, we can return null or throw a dedicated error.
      // Returning null here to let the controller handle the simple 404 response.
      return null; 
    }

    return user;
  }

  /**
   * Updates user profile fields.
   * @param {number} userId 
   * @param {object} updateData 
   * @returns {object} Updated user data
   */
  async updateProfile(userId, updateData) {
    const { name, email, city, state, gender, profile_picture } = updateData;

    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Prepare update object, filtering undefined/null values
    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;
    if (email) fieldsToUpdate.email = email;
    if (city) fieldsToUpdate.city = city;
    if (state) fieldsToUpdate.state = state;
    if (gender) fieldsToUpdate.gender = gender;
    if (profile_picture) fieldsToUpdate.profile_picture = profile_picture;

    await user.update(fieldsToUpdate);

    // Return sanitized user data
    return {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      city: user.city,
      state: user.state,
      gender: user.gender,
      profile_picture: user.profile_picture
    };
  }

  /**
   * Changes a user's password.
   * @param {number} userId 
   * @param {string} current_password 
   * @param {string} new_password 
   */
  async changePassword(userId, current_password, new_password) {
    if (new_password.length < 6) {
      throw new ValidationError('New password must be at least 6 characters');
    }
    
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const password_hash = await bcrypt.hash(new_password, 12);

    // Update password
    await user.update({ password_hash });
  }

  /**
   * Updates vendor shop details.
   * @param {number} userId 
   * @param {object} updateData 
   * @returns {object} Updated vendor shop data
   */
  async updateVendorShop(userId, updateData) {
    const {
      shop_name, shop_address, city, state, latitude, longitude,
      open_time, close_time, break_start_time, break_end_time,
      weekly_holiday, no_of_seats, no_of_workers
    } = updateData;

    const vendorShop = await VendorShop.findOne({
      where: { user_id: userId }
    });

    if (!vendorShop) {
      throw new NotFoundError('Vendor shop not found');
    }

    // Prepare update object
    const fieldsToUpdate = {};
    if (shop_name) fieldsToUpdate.shop_name = shop_name;
    if (shop_address) fieldsToUpdate.shop_address = shop_address;
    if (city) fieldsToUpdate.city = city;
    if (state) fieldsToUpdate.state = state;
    if (latitude) fieldsToUpdate.latitude = latitude;
    if (longitude) fieldsToUpdate.longitude = longitude;
    if (open_time) fieldsToUpdate.open_time = open_time;
    if (close_time) fieldsToUpdate.close_time = close_time;
    // Check for explicit undefined/null to allow clearing break times
    if (break_start_time !== undefined) fieldsToUpdate.break_start_time = break_start_time;
    if (break_end_time !== undefined) fieldsToUpdate.break_end_time = break_end_time;
    if (weekly_holiday !== undefined) fieldsToUpdate.weekly_holiday = weekly_holiday;
    if (no_of_seats) fieldsToUpdate.no_of_seats = no_of_seats;
    if (no_of_workers) fieldsToUpdate.no_of_workers = no_of_workers;
    
    await vendorShop.update(fieldsToUpdate);

    return vendorShop;
  }

  /**
   * Soft deletes a user account after password verification.
   * @param {number} userId 
   * @param {string} password 
   */
  async deleteAccount(userId, password) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Incorrect password');
    }

    // Soft delete (requires 'paranoid: true' on the User model)
    await user.destroy();
  }
}

module.exports = new AuthService();