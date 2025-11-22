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
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active'
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
    }
  }, {
    tableName: 'users',
    timestamps: true,
    paranoid: false,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
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
