const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Booking = sequelize.define('Booking', {
    booking_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    booking_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    payment_method: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    payment_status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending'
    },
    booking_status: {
      type: DataTypes.STRING(20),
      defaultValue: 'confirmed'
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cancelled_by: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active'
    }
  }, {
    tableName: 'bookings',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  Booking.associate = (models) => {
    Booking.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'customer'
    });
    Booking.belongsTo(models.User, {
      foreignKey: 'vendor_id',
      as: 'vendor'
    });
    Booking.hasMany(models.BookingService, {
      foreignKey: 'booking_id',
      as: 'services'
    });
    Booking.hasOne(models.Review, {
      foreignKey: 'booking_id',
      as: 'review'
    });
  };

  return Booking;
};
