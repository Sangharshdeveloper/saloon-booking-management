// src/constants/user.constants.js
module.exports = {
  USER_ROLES: {
    CUSTOMER: 'customer',
    VENDOR: 'vendor',
    ADMIN: 'admin'
  },
  
  USER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DELETED: 'deleted',
    SUSPENDED: 'suspended'
  },
  
  GENDER: {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other'
  },
  
  MIN_NAME_LENGTH: 2,
  MIN_PASSWORD_LENGTH: 6,
  MAX_PASSWORD_LENGTH: 128
};