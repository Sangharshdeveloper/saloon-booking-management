// models/User.js - Unified User Model

const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');

const sequelize = require('../config/database');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    phone_number: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    user_type: {
      type: DataTypes.ENUM('customer', 'vendor', 'admin','vendor'),
      allowNull: false,
      defaultValue: 'customer'
    },
    role: {
      type: DataTypes.ENUM('user', 'admin', 'super_admin', 'manager','vendor'),
      allowNull: true,
      defaultValue: 'vendor'
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    gender: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    profile_picture: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'deleted'),
      defaultValue: 'active'
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    device_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fcm_token: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['phone_number'] },
      { fields: ['email'] },
      { fields: ['user_type'] },
      { fields: ['status'] },
      { fields: ['created_at'] }
    ]
  });

  User.associate = (models) => {
    // Vendor shop association
    User.hasOne(models.VendorShop, {
      foreignKey: 'user_id',
      as: 'vendorShop'
    });

    // Bookings as customer
    // User.hasMany(models.Booking, {
    //   foreignKey: 'user_id',
    //   as: 'customerBookings'
    // });

    // Bookings as vendor
    // User.hasMany(models.Booking, {
    //   foreignKey: 'vendor_id',
    //   as: 'vendorBookings'
    // });

    // Reviews as customer
    // User.hasMany(models.Review, {
    //   foreignKey: 'user_id',
    //   as: 'givenReviews'
    // });

    // Reviews as vendor
    // User.hasMany(models.Review, {
    //   foreignKey: 'vendor_id',
    //   as: 'receivedReviews'
    // });

    // Notifications as customer
    // User.hasMany(models.Notification, {
    //   foreignKey: 'user_id',
    //   as: 'customerNotifications'
    // });

    // Notifications as vendor
    // User.hasMany(models.Notification, {
    //   foreignKey: 'vendor_id',
    //   as: 'vendorNotifications'
    // });

    // Vendor services
    // User.hasMany(models.VendorService, {
    //   foreignKey: 'vendor_id',
    //   as: 'services'
    // });

    // Vendor images
    User.hasMany(models.VendorImage, {
      foreignKey: 'vendor_id',
      as: 'images'
    });

    // Vendor holidays
    User.hasMany(models.VendorHoliday, {
      foreignKey: 'vendor_id',
      as: 'holidays'
    });

    // Vendor early closures
    User.hasMany(models.VendorEarlyClosure, {
      foreignKey: 'vendor_id',
      as: 'earlyClosures'
    });

    // Verification documents
    User.hasMany(models.VerificationDocument, {
      foreignKey: 'vendor_id',
      as: 'documents'
    });
  };

  return User;
};
