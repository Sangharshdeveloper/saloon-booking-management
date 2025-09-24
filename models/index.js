const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Define all models
const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  phone_number: {
    type: DataTypes.STRING(15),
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: { isEmail: true }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  city: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  state: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  device_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
  }
}, {
  tableName: 'users',
  timestamps: true,
  paranoid: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
});

const Vendor = sequelize.define('Vendor', {
  vendor_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  owner_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  phone_number: {
    type: DataTypes.STRING(15),
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: { isEmail: true }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
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
    allowNull: false
  },
  no_of_workers: {
    type: DataTypes.INTEGER,
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
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
  }
}, {
  tableName: 'vendors',
  timestamps: true,
  paranoid: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
});

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

const VendorService = sequelize.define('VendorService', {
  vendor_service_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Vendor,
      key: 'vendor_id'
    }
  },
  service_id: {
    type: DataTypes.INTEGER,
    references: {
      model: ServicesMaster,
      key: 'service_id'
    }
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

const VendorImage = sequelize.define('VendorImage', {
  image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Vendor,
      key: 'vendor_id'
    }
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

const Booking = sequelize.define('Booking', {
  booking_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'user_id'
    }
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Vendor,
      key: 'vendor_id'
    }
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

const BookingService = sequelize.define('BookingService', {
  booking_service_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  booking_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Booking,
      key: 'booking_id'
    }
  },
  service_id: {
    type: DataTypes.INTEGER,
    references: {
      model: ServicesMaster,
      key: 'service_id'
    }
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

const Review = sequelize.define('Review', {
  review_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  booking_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Booking,
      key: 'booking_id'
    }
  },
  user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'user_id'
    }
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Vendor,
      key: 'vendor_id'
    }
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  review_text: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
  }
}, {
  tableName: 'reviews',
  timestamps: true,
  paranoid: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
});

const VendorHoliday = sequelize.define('VendorHoliday', {
  holiday_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Vendor,
      key: 'vendor_id'
    }
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

const VendorEarlyClosure = sequelize.define('VendorEarlyClosure', {
  closure_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Vendor,
      key: 'vendor_id'
    }
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

const Notification = sequelize.define('Notification', {
  notification_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'user_id'
    },
    allowNull: true
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Vendor,
      key: 'vendor_id'
    },
    allowNull: true
  },
  booking_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Booking,
      key: 'booking_id'
    },
    allowNull: true
  },
  notification_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sent_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  paranoid: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
});

const AdminUser = sequelize.define('AdminUser', {
  admin_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false,
    validate: { isEmail: true }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  full_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  role: {
    type: DataTypes.STRING(20),
    defaultValue: 'admin'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
  }
}, {
  tableName: 'admin_users',
  timestamps: true,
  paranoid: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
});

const VerificationDocument = sequelize.define('VerificationDocument', {
  document_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Vendor,
      key: 'vendor_id'
    }
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

// Define associations
// User associations
User.hasMany(Booking, { foreignKey: 'user_id' });
User.hasMany(Review, { foreignKey: 'user_id' });
User.hasMany(Notification, { foreignKey: 'user_id' });

// Vendor associations
Vendor.hasMany(Booking, { foreignKey: 'vendor_id' });
Vendor.hasMany(VendorService, { foreignKey: 'vendor_id' });
Vendor.hasMany(VendorImage, { foreignKey: 'vendor_id' });
Vendor.hasMany(Review, { foreignKey: 'vendor_id' });
Vendor.hasMany(VendorHoliday, { foreignKey: 'vendor_id' });
Vendor.hasMany(VendorEarlyClosure, { foreignKey: 'vendor_id' });
Vendor.hasMany(Notification, { foreignKey: 'vendor_id' });
Vendor.hasMany(VerificationDocument, { foreignKey: 'vendor_id' });

// ServicesMaster associations
ServicesMaster.hasMany(VendorService, { foreignKey: 'service_id' });
ServicesMaster.hasMany(BookingService, { foreignKey: 'service_id' });

// Booking associations
Booking.belongsTo(User, { foreignKey: 'user_id' });
Booking.belongsTo(Vendor, { foreignKey: 'vendor_id' });
Booking.hasMany(BookingService, { foreignKey: 'booking_id' });
Booking.hasOne(Review, { foreignKey: 'booking_id' });
Booking.hasMany(Notification, { foreignKey: 'booking_id' });

// BookingService associations
BookingService.belongsTo(Booking, { foreignKey: 'booking_id' });
BookingService.belongsTo(ServicesMaster, { foreignKey: 'service_id' });

// VendorService associations
VendorService.belongsTo(Vendor, { foreignKey: 'vendor_id' });
VendorService.belongsTo(ServicesMaster, { foreignKey: 'service_id' });

// VendorImage associations
VendorImage.belongsTo(Vendor, { foreignKey: 'vendor_id' });

// Review associations
Review.belongsTo(User, { foreignKey: 'user_id' });
Review.belongsTo(Vendor, { foreignKey: 'vendor_id' });
Review.belongsTo(Booking, { foreignKey: 'booking_id' });

// VendorHoliday associations
VendorHoliday.belongsTo(Vendor, { foreignKey: 'vendor_id' });

// VendorEarlyClosure associations
VendorEarlyClosure.belongsTo(Vendor, { foreignKey: 'vendor_id' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'user_id' });
Notification.belongsTo(Vendor, { foreignKey: 'vendor_id' });
Notification.belongsTo(Booking, { foreignKey: 'booking_id' });

// VerificationDocument associations
VerificationDocument.belongsTo(Vendor, { foreignKey: 'vendor_id' });

module.exports = {
  sequelize,
  User,
  Vendor,
  ServicesMaster,
  VendorService,
  VendorImage,
  Booking,
  BookingService,
  Review,
  VendorHoliday,
  VendorEarlyClosure,
  Notification,
  AdminUser,
  VerificationDocument
};



// Define associations
// User associations
User.hasMany(Booking, { foreignKey: 'user_id' });
User.hasMany(Review, { foreignKey: 'user_id' });
User.hasMany(Notification, { foreignKey: 'user_id' });

// Vendor associations
Vendor.hasMany(Booking, { foreignKey: 'vendor_id' });
Vendor.hasMany(VendorService, { foreignKey: 'vendor_id' });
Vendor.hasMany(VendorImage, { foreignKey: 'vendor_id' });
Vendor.hasMany(Review, { foreignKey: 'vendor_id' });
Vendor.hasMany(VendorHoliday, { foreignKey: 'vendor_id' });
Vendor.hasMany(VendorEarlyClosure, { foreignKey: 'vendor_id' });
Vendor.hasMany(Notification, { foreignKey: 'vendor_id' });
Vendor.hasMany(VerificationDocument, { foreignKey: 'vendor_id' });

// ServicesMaster associations
ServicesMaster.hasMany(VendorService, { foreignKey: 'service_id' });
ServicesMaster.hasMany(BookingService, { foreignKey: 'service_id' });

// Booking associations
Booking.belongsTo(User, { foreignKey: 'user_id' });
Booking.belongsTo(Vendor, { foreignKey: 'vendor_id' });
Booking.hasMany(BookingService, { foreignKey: 'booking_id' });
Booking.hasOne(Review, { foreignKey: 'booking_id' });
Booking.hasMany(Notification, { foreignKey: 'booking_id' });

// BookingService associations
BookingService.belongsTo(Booking, { foreignKey: 'booking_id' });
BookingService.belongsTo(ServicesMaster, { foreignKey: 'service_id' });

// VendorService associations
VendorService.belongsTo(Vendor, { foreignKey: 'vendor_id' });
VendorService.belongsTo(ServicesMaster, { foreignKey: 'service_id' });

// VendorImage associations
VendorImage.belongsTo(Vendor, { foreignKey: 'vendor_id' });

// Review associations
Review.belongsTo(User, { foreignKey: 'user_id' });
Review.belongsTo(Vendor, { foreignKey: 'vendor_id' });
Review.belongsTo(Booking, { foreignKey: 'booking_id' });

// VendorHoliday associations
VendorHoliday.belongsTo(Vendor, { foreignKey: 'vendor_id' });

// VendorEarlyClosure associations
VendorEarlyClosure.belongsTo(Vendor, { foreignKey: 'vendor_id' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'user_id' });
Notification.belongsTo(Vendor, { foreignKey: 'vendor_id' });
Notification.belongsTo(Booking, { foreignKey: 'booking_id' });

// VerificationDocument associations
VerificationDocument.belongsTo(Vendor, { foreignKey: 'vendor_id' });

module.exports = {
  sequelize,
  User,
  Vendor,
  ServicesMaster,
  VendorService,
  VendorImage,
  Booking,
  BookingService,
  Review,
  VendorHoliday,
  VendorEarlyClosure,
  Notification,
  AdminUser,
  VerificationDocument
};