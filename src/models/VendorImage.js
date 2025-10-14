const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VendorImage = sequelize.define('VendorImage', {
    image_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    image_type: {
      type: DataTypes.STRING(20),
      defaultValue: 'gallery'
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active'
    }
  }, {
    tableName: 'vendor_images',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  VendorImage.associate = (models) => {
    VendorImage.belongsTo(models.User, {
      foreignKey: 'vendor_id',
      as: 'vendor'
    });
  };

  return VendorImage;
};