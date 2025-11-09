// src/constants/vendor.constants.js
module.exports = {
  VERIFICATION_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    UNDER_REVIEW: 'under_review'
  },
  
  VENDOR_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    DELETED: 'deleted'
  },
  
  IMAGE_TYPE: {
    HOMEPAGE: 'homepage',
    GALLERY: 'gallery',
    PROFILE: 'profile'
  },
  
  DOCUMENT_TYPE: {
    BUSINESS_LICENSE: 'business_license',
    ID_PROOF: 'id_proof',
    ADDRESS_PROOF: 'address_proof',
    TAX_CERTIFICATE: 'tax_certificate'
  },
  
  SORT_OPTIONS: {
    RATING: 'rating',
    DISTANCE: 'distance',
    PRICE: 'price',
    MOST_BOOKED: 'most_booked'
  },
  
  MIN_SEATS: 1,
  MIN_WORKERS: 1,
  MAX_SEATS: 100,
  MAX_WORKERS: 50
};