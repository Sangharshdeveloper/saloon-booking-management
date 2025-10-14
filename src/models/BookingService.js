const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingService = sequelize.define('BookingService', {
    booking_service_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'bookings', key: 'booking_id' }
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'services_master', key: 'service_id' }
    },
    service_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    service_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active'
    }
  }, {
    tableName: 'booking_services',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  BookingService.associate = (models) => {
    BookingService.belongsTo(models.Booking, {
      foreignKey: 'booking_id',
      as: 'booking'
    });
    BookingService.belongsTo(models.ServicesMaster, {
      foreignKey: 'service_id',
      as: 'service'
    });
  };

  return BookingService;
}