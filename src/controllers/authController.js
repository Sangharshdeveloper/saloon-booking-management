// controllers/authController.js - Updated for Unified User Structure

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, VendorShop } = require('../models');
const { Op } = require('sequelize');

// ============================================
// CUSTOMER REGISTRATION
// ============================================
exports.registerCustomer = async (req, res) => {
  try {
    const { name, phone_number, email, password, city, state, gender, device_id } = req.body;

    // Validation
    if (!name || !phone_number || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone number and password are required'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      where: { phone_number }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
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

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, user_type: 'customer', role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: {
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
      }
    });
  } catch (error) {
    console.error('Customer registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// ============================================
// VENDOR REGISTRATION
// ============================================
exports.registerVendor = async (req, res) => {
  const transaction = await User.sequelize.transaction();
  
  try {
    const {
      // User details
      name,
      phone_number,
      email,
      password,
      city,
      state,
      // Shop details
      shop_name,
      shop_address,
      shop_city,
      shop_state,
      latitude,
      longitude,
      open_time,
      close_time,
      break_start_time,
      break_end_time,
      weekly_holiday,
      no_of_seats,
      no_of_workers
    } = req.body;

    // Validation
    if (!name || !phone_number || !password || !shop_name || !shop_address) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Required fields missing'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      where: { phone_number }
    });

    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
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

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, user_type: 'vendor', role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Vendor registered successfully. Awaiting admin approval.',
      data: {
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
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Vendor registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// ============================================
// LOGIN (Unified for all user types)
// ============================================
exports.login = async (req, res) => {
  try {
    const { phone_number, password, user_type } = req.body;

    // Validation
    if (!phone_number || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required'
      });
    }

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
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        user_type: user.user_type,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

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

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: responseData
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// ============================================
// ADMIN LOGIN
// ============================================
exports.adminLogin = async (req, res) => {
  try {
    const { phone_number, password } = req.body;

    // Validation
    if (!phone_number || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required'
      });
    }

    // Find admin user
    const user = await User.findOne({
      where: { 
        phone_number,
        user_type: 'admin'
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        user_type: 'admin',
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        admin: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          user_type: user.user_type
        },
        token
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// ============================================
// GET PROFILE
// ============================================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.user_id; // From JWT middleware

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] },
      include: req.user.user_type === 'vendor' ? [{
        model: VendorShop,
        as: 'vendorShop'
      }] : []
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// ============================================
// UPDATE PROFILE
// ============================================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { name, email, city, state, gender, profile_picture } = req.body;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    await user.update({
      ...(name && { name }),
      ...(email && { email }),
      ...(city && { city }),
      ...(state && { state }),
      ...(gender && { gender }),
      ...(profile_picture && { profile_picture })
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          city: user.city,
          state: user.state,
          gender: user.gender,
          profile_picture: user.profile_picture
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// ============================================
// CHANGE PASSWORD
// ============================================
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { current_password, new_password } = req.body;

    // Validation
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(new_password, 12);

    // Update password
    await user.update({ password_hash });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// ============================================
// UPDATE VENDOR SHOP
// ============================================
exports.updateVendorShop = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Verify user is a vendor
    if (req.user.user_type !== 'vendor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendors can update shop details.'
      });
    }

    const {
      shop_name,
      shop_address,
      city,
      state,
      latitude,
      longitude,
      open_time,
      close_time,
      break_start_time,
      break_end_time,
      weekly_holiday,
      no_of_seats,
      no_of_workers
    } = req.body;

    const vendorShop = await VendorShop.findOne({
      where: { user_id: userId }
    });

    if (!vendorShop) {
      return res.status(404).json({
        success: false,
        message: 'Vendor shop not found'
      });
    }

    // Update shop details
    await vendorShop.update({
      ...(shop_name && { shop_name }),
      ...(shop_address && { shop_address }),
      ...(city && { city }),
      ...(state && { state }),
      ...(latitude && { latitude }),
      ...(longitude && { longitude }),
      ...(open_time && { open_time }),
      ...(close_time && { close_time }),
      ...(break_start_time !== undefined && { break_start_time }),
      ...(break_end_time !== undefined && { break_end_time }),
      ...(weekly_holiday !== undefined && { weekly_holiday }),
      ...(no_of_seats && { no_of_seats }),
      ...(no_of_workers && { no_of_workers })
    });

    return res.status(200).json({
      success: true,
      message: 'Shop details updated successfully',
      data: { shop: vendorShop }
    });
  } catch (error) {
    console.error('Update vendor shop error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update shop details',
      error: error.message
    });
  }
};

// ============================================
// DELETE ACCOUNT
// ============================================
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { password } = req.body;

    // Validation
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Soft delete (paranoid: true in model)
    await user.destroy();

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
};