const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VendorEarlyClosure = sequelize.define('VendorEarlyClosure', {
    closure_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    closure_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    early_close_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active'
    }
  }, {
    tableName: 'vendor_early_closures',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  VendorEarlyClosure.associate = (models) => {
    VendorEarlyClosure.belongsTo(models.User, {
      foreignKey: 'vendor_id',
      as: 'vendor'
    });
  };

  return VendorEarlyClosure;
};
