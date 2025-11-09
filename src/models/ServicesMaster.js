const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ServicesMaster = sequelize.define('ServicesMaster', {
    service_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    service_name: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false
    },
    service_description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    default_duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    service_type: {
      type: DataTypes.STRING(20),
      defaultValue: 'normal'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active'
    }
  }, {
    tableName: 'services_master',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  ServicesMaster.associate = (models) => {
    ServicesMaster.hasMany(models.VendorService, {
      foreignKey: 'service_id',
      as: 'vendorServices'
    });
    ServicesMaster.hasMany(models.BookingService, {
      foreignKey: 'service_id',
      as: 'bookingServices'
    });
  };

  return ServicesMaster;
};