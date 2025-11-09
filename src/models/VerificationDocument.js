const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VerificationDocument = sequelize.define('VerificationDocument', {
    document_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    document_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    document_url: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    verification_status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending'
    },
    admin_comments: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active'
    }
  }, {
    tableName: 'verification_documents',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  VerificationDocument.associate = (models) => {
    VerificationDocument.belongsTo(models.User, {
      foreignKey: 'vendor_id',
      as: 'vendor'
    });
  };

  return VerificationDocument;
};