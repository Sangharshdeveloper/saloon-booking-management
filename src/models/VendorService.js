const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const VendorService = sequelize.define('VendorService', {
    vendor_service_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'services_master', key: 'service_id' }
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active'
    }
  }, {
    tableName: 'vendor_services',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  VendorService.associate = (models) => {
    VendorService.belongsTo(models.User, {
      foreignKey: 'vendor_id',
      as: 'vendor'
    });
    VendorService.belongsTo(models.ServicesMaster, {
      foreignKey: 'service_id',
      as: 'service'
    });
  };

  return VendorService;
};