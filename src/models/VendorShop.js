const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VendorShop = sequelize.define('VendorShop', {
    shop_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    shop_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    shop_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    state: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    open_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    close_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    break_start_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    break_end_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    weekly_holiday: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    no_of_seats: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    no_of_workers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    verification_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    admin_comments: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    verified_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    business_license: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    tax_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    bank_account_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    bank_ifsc_code: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    average_rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.00
    },
    total_reviews: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_bookings: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_revenue: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'deleted'),
      defaultValue: 'active'
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
    tableName: 'vendor_shops',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['city'] },
      { fields: ['verification_status'] },
      { fields: ['status'] }
    ]
  });

  VendorShop.associate = (models) => {
    VendorShop.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    VendorShop.belongsTo(models.User, {
      foreignKey: 'verified_by',
      as: 'verifier'
    });
  };

  return VendorShop;
};