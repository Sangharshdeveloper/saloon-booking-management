// models/index.js - Refactored for Unified User Structure
const { DataTypes } = require('sequelize');
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

const db = {};

// Import models
db.User = require('./User')(sequelize, Sequelize.DataTypes);
db.VendorShop = require('./VendorShop')(sequelize, Sequelize.DataTypes);
db.ServicesMaster = require('./ServicesMaster')(sequelize, Sequelize.DataTypes);
db.VendorService = require('./VendorService')(sequelize, Sequelize.DataTypes);
db.VendorImage = require('./VendorImage')(sequelize, Sequelize.DataTypes);
db.Booking = require('./Booking')(sequelize, Sequelize.DataTypes);
db.BookingService = require('./BookingService')(sequelize, Sequelize.DataTypes);
db.Review = require('./Review')(sequelize, Sequelize.DataTypes);
db.VendorHoliday = require('./VendorHoliday')(sequelize, Sequelize.DataTypes);
db.VendorEarlyClosure = require('./VendorEarlyClosure')(sequelize, Sequelize.DataTypes);
db.Notification = require('./Notification')(sequelize, Sequelize.DataTypes);
db.VerificationDocument = require('./VerificationDocument')(sequelize, Sequelize.DataTypes);

// Initialize associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;