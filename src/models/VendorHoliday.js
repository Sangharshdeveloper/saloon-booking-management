const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VendorHoliday = sequelize.define('VendorHoliday', {
    holiday_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    holiday_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    holiday_reason: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active'
    }
  }, {
    tableName: 'vendor_holidays',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  VendorHoliday.associate = (models) => {
    VendorHoliday.belongsTo(models.User, {
      foreignKey: 'vendor_id',
      as: 'vendor'
    });
  };

  return VendorHoliday;
};