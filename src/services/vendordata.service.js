const { Sequelize,Op } = require('sequelize');
const { 
  Vendor,
  VendorService, 
  VendorImage, 
  ServicesMaster, 
  VendorHoliday,
  VendorEarlyClosure,
  Review,
  Booking,
  User,
  BookingService // Assumed model for mapping service to booking records
} = require('../models');

// Assuming you have custom error handlers defined in utils/errors
const { 
  NotFoundError, 
  ValidationError, 
  ForbiddenError 
} = require('../utils/errors'); 

class VendordataService {

  /**
   * Handles complex vendor search, filtering, calculation, and sorting logic.
   * @param {object} query - Contains all search, filter, and pagination parameters
   * @returns {object} { vendors: [...], pagination: {...} }
   */
  async searchVendors(query) {
    const {
      city, service_type, rating, sort_by = 'rating',
      page = 1, limit = 10, search
    } = query;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const offset = (parsedPage - 1) * parsedLimit;
    
    // Build where conditions for Vendor model
    let whereConditions = {
      verification_status: 'approved',
      status: 'active'
    };

    if (city) {
      whereConditions.city = { [Op.iLike]: `%${city}%` };
    }

    if (search) {
      whereConditions[Op.or] = [
        { shop_name: { [Op.iLike]: `%${search}%` } },
        { shop_address: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Include conditions
    let includeConditions = [
      {
        model: VendorService,
        as: 'VendorServices',
        where: { status: 'active', is_available: true },
        include: [{ model: ServicesMaster, as: 'ServicesMaster' }],
        required: false
      },
      {
        model: VendorImage,
        as: 'VendorImages',
        where: { status: 'active' },
        required: false
      },
      {
        model: Review,
        as: 'Reviews',
        required: false,
        attributes: ['rating']
      }
    ];

    // Filter by service type
    if (service_type) {
      // Set where condition on ServicesMaster and make VendorService required
      includeConditions[0].include[0].where = {
        service_name: { [Op.iLike]: `%${service_type}%` }
      };
      includeConditions[0].required = true;
    }

    // Fetch vendors
    const { count, rows: vendors } = await Vendor.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      limit: parsedLimit,
      offset,
      // Prevents cartesian product issues when using required:false includes
      distinct: true, 
      col: 'vendor_id'
    });

    // Calculate additional fields for each vendor
    let vendorsWithStats = await Promise.all(vendors.map(async (vendor) => {
      const vendorData = vendor.toJSON();
      
      // Calculate average rating based on fetched reviews
      const avgRating = vendorData.Reviews.length > 0 
        ? vendorData.Reviews.reduce((sum, review) => sum + review.rating, 0) / vendorData.Reviews.length 
        : 0;
      
      // Get minimum service price
      const minPrice = vendorData.VendorServices.length > 0 
        ? Math.min(...vendorData.VendorServices.map(service => parseFloat(service.price)))
        : 0;
      
      // Get booking count (for most_booked sort)
      const bookingCount = await Booking.count({
        where: { 
          vendor_id: vendorData.vendor_id,
          booking_status: 'completed'
        }
      });

      // Get primary image
      const primaryImage = vendorData.VendorImages.find(img => img.image_type === 'homepage') ||
                          vendorData.VendorImages[0];

      return {
        ...vendorData,
        average_rating: Math.round(avgRating * 10) / 10,
        total_reviews: vendorData.Reviews.length,
        min_price: minPrice,
        booking_count: bookingCount,
        primary_image: primaryImage?.image_url || null,
        total_images: vendorData.VendorImages.length
      };
    }));

    // Apply sorting in memory
    switch (sort_by) {
      case 'rating':
        vendorsWithStats.sort((a, b) => b.average_rating - a.average_rating);
        break;
      case 'price':
        vendorsWithStats.sort((a, b) => a.min_price - b.min_price);
        break;
      case 'most_booked':
        vendorsWithStats.sort((a, b) => b.booking_count - a.booking_count);
        break;
      case 'distance':
        // TODO: Implement distance-based sorting using user location
        break;
    }

    // Apply rating filter after calculation
    const filteredVendors = rating 
      ? vendorsWithStats.filter(vendor => vendor.average_rating >= parseFloat(rating))
      : vendorsWithStats;
    
    return {
      vendors: filteredVendors,
      pagination: {
        current_page: parsedPage,
        total_pages: Math.ceil(count / parsedLimit),
        total_count: count,
        per_page: parsedLimit
      }
    };
  }

  /**
   * Fetches detailed vendor data for a specific ID.
   */
  async getVendorById(vendorId) {
    const vendor = await Vendor.findOne({
      where: { 
        vendor_id: vendorId,
        verification_status: 'approved',
        status: 'active'
      },
      include: [
        {
          model: VendorService,
          as: 'VendorServices',
          where: { status: 'active', is_available: true },
          include: [{ model: ServicesMaster, as: 'ServicesMaster' }],
          required: false
        },
        {
          model: VendorImage,
          as: 'VendorImages',
          where: { status: 'active' },
          required: false
        },
        {
          model: Review,
          as: 'Reviews',
          include: [{
            model: User,
            attributes: ['user_id', 'name', 'email']
          }],
          limit: 10, // Fetch top 10 recent reviews
          order: [['created_at', 'DESC']],
          required: false
        }
      ]
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found or not approved/active');
    }

    const vendorData = vendor.toJSON();

    // Calculate total reviews (unlimited count)
    const totalReviews = await Review.count({
      where: { vendor_id: vendorId }
    });
    
    // Calculate average rating based on the limited fetched reviews (following original controller logic)
    const avgRating = vendorData.Reviews.length > 0 
        ? vendorData.Reviews.reduce((sum, review) => sum + review.rating, 0) / vendorData.Reviews.length 
        : 0;

    return {
      ...vendorData,
      average_rating: Math.round(avgRating * 10) / 10,
      total_reviews: totalReviews
    };
  }

  // --- Profile Management ---

  async updateProfile(vendorId, updateData) {
    const vendor = await Vendor.findByPk(vendorId);

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    // Remove non-updatable fields
    delete updateData.phone_number;
    delete updateData.verification_status;
    delete updateData.user_type;

    await vendor.update(updateData);

    return vendor;
  }

  async uploadImages(vendorId, files, imageType) {
    // If uploading homepage image, remove existing homepage image flag
    if (imageType === 'homepage') {
      await VendorImage.update(
        { image_type: 'gallery', is_primary: false },
        { where: { vendor_id: vendorId, image_type: 'homepage' } }
      );
    }

    const uploadedImages = await Promise.all(
      files.map(async (file, index) => {
        const isPrimary = imageType === 'homepage' && index === 0;
        const finalImageType = isPrimary ? 'homepage' : 'gallery';

        return await VendorImage.create({
          vendor_id: vendorId,
          // NOTE: Assumes files contains a path or filename property
          image_url: `/uploads/vendors/${file.filename}`, 
          image_type: finalImageType,
          is_primary: isPrimary,
          status: 'active'
        });
      })
    );

    return uploadedImages;
  }

  async deleteImage(vendorId, imageId) {
    const image = await VendorImage.findOne({
      where: { image_id: imageId, vendor_id: vendorId }
    });

    if (!image) {
      throw new NotFoundError('Image not found or does not belong to this vendor');
    }

    await image.destroy();
  }

  // --- Availability Management ---

  async addHoliday(vendorId, holidayDate, holidayReason) {
    // Check if holiday already exists
    const existingHoliday = await VendorHoliday.findOne({
      where: { vendor_id: vendorId, holiday_date: holidayDate }
    });

    if (existingHoliday) {
      throw new ValidationError('Holiday already exists for this date');
    }

    const holiday = await VendorHoliday.create({
      vendor_id: vendorId,
      holiday_date: holidayDate,
      holiday_reason: holidayReason
    });

    // TODO: Implement complex booking cancellation/notification logic here
    // Example: await BookingService.cancelBookingsForHoliday(vendorId, holidayDate);

    return holiday;
  }

  async setEarlyClosure(vendorId, closureDate, earlyCloseTime, reason) {
    // Find vendor to get regular close time
    const vendor = await Vendor.findByPk(vendorId, { attributes: ['close_time'] });
    
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    // Validate early close time is before regular close time
    if (earlyCloseTime >= vendor.close_time) {
      throw new ValidationError('Early close time must be strictly before regular close time');
    }

    const [earlyClosure, created] = await VendorEarlyClosure.findOrCreate({
      where: { vendor_id: vendorId, closure_date: closureDate },
      defaults: {
        vendor_id: vendorId,
        closure_date: closureDate,
        early_close_time: earlyCloseTime,
        reason
      }
    });

    if (!created) {
      await earlyClosure.update({
        early_close_time: earlyCloseTime,
        reason
      });
    }

    // TODO: Implement booking cancellation/notification logic for affected bookings
    // Example: await BookingService.handleEarlyClosure(vendorId, closureDate, earlyCloseTime);

    return { earlyClosure, created };
  }

  // --- Account Status Management ---
  
  async deactivateAccount(vendorId, reason) {
    const upcomingBookings = await Booking.count({
      where: {
        vendor_id: vendorId,
        booking_status: 'confirmed',
        booking_date: { [Op.gte]: new Date() }
      }
    });

    if (upcomingBookings > 0) {
      throw new ValidationError(
        `Cannot deactivate account with ${upcomingBookings} upcoming confirmed bookings. Please handle them first.`
      );
    }

    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    await vendor.update({
      status: 'inactive',
      admin_comments: reason ? `Deactivated by vendor. Reason: ${reason}` : 'Deactivated by vendor'
    });
  }

  async removeVendor(vendorId, requestingUserId, userRole) {
    const vendor = await Vendor.findByPk(vendorId);

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    // Authorization check
    if (userRole !== 'admin' && requestingUserId !== vendorId) {
      throw new ForbiddenError('You are not authorized to perform this action');
    }

    // Check for active/confirmed bookings
    const activeBookings = await Booking.count({
      where: {
        vendor_id: vendorId,
        booking_status: { [Op.in]: ['confirmed', 'pending'] },
        booking_date: { [Op.gte]: new Date() }
      }
    });

    if (activeBookings > 0) {
      throw new ValidationError(
        `Cannot delete vendor with ${activeBookings} active bookings. Please complete or cancel them first.`
      );
    }

    // Soft delete - update status instead of actual deletion
    await vendor.update({
      status: 'deleted',
      admin_comments: `Deleted by ${userRole} on ${new Date().toISOString()}`
    });

    // Also deactivate all vendor services
    await VendorService.update(
      { status: 'inactive', is_available: false },
      { where: { vendor_id: vendorId } }
    );
    
    return { 
      vendor_id: vendorId,
      deleted_at: new Date()
    };
  }

  async permanentlyDeleteVendor(vendorId, userRole) {
    // Only admin can permanently delete
    if (userRole !== 'admin') {
      throw new ForbiddenError('Only administrators can permanently delete vendors');
    }

    const vendor = await Vendor.findByPk(vendorId);

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    // Check for any bookings (past or present)
    const totalBookings = await Booking.count({
      where: { vendor_id: vendorId }
    });

    if (totalBookings > 0) {
      throw new ValidationError(
        `Cannot permanently delete vendor with booking history (${totalBookings} bookings found). Consider soft delete instead.`
      );
    }
    
    // Use transaction for safety
    const transaction = await Vendor.sequelize.transaction();
    try {
      // Delete related records first (if models don't have cascade delete set up)
      await Promise.all([
        VendorService.destroy({ where: { vendor_id: vendorId }, transaction }),
        VendorImage.destroy({ where: { vendor_id: vendorId }, transaction }),
        VendorHoliday.destroy({ where: { vendor_id: vendorId }, transaction }),
        VendorEarlyClosure.destroy({ where: { vendor_id: vendorId }, transaction }),
        Review.destroy({ where: { vendor_id: vendorId }, transaction })
      ]);

      // Finally delete vendor
      await vendor.destroy({ transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
    return { 
      vendor_id: vendorId,
      deleted_at: new Date()
    };
  }

  // --- Dashboard and Stats ---

  async getDashboardStats(vendorId) {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalBookings,
      todaysBookings,
      completedBookings,
      monthlyRevenue,
      reviewStats
    ] = await Promise.all([
      Booking.count({ where: { vendor_id: vendorId } }),
      Booking.count({ 
        where: { 
          vendor_id: vendorId, 
          booking_date: today,
          booking_status: { [Op.in]: ['confirmed', 'completed'] }
        } 
      }),
      Booking.count({ 
        where: { 
          vendor_id: vendorId, 
          booking_status: 'completed' 
        } 
      }),
      Booking.sum('total_amount', {
        where: {
          vendor_id: vendorId,
          booking_status: 'completed',
          created_at: { [Op.gte]: thirtyDaysAgo }
        }
      }),
      Review.findAll({
        attributes: [
          [Vendor.sequelize.fn('AVG', Vendor.sequelize.col('rating')), 'averageRating'],
          [Vendor.sequelize.fn('COUNT', Vendor.sequelize.col('review_id')), 'totalReviews']
        ],
        where: { vendor_id: vendorId },
        raw: true
      }),
      // TODO: Implement fetching popular services (e.g., top 3 by completed booking count)
    ]);
    
    const avgRating = parseFloat(reviewStats[0].averageRating) || 0;
    const totalReviews = parseInt(reviewStats[0].totalReviews) || 0;
    
    return {
      total_bookings: totalBookings,
      todays_bookings: todaysBookings,
      completed_bookings: completedBookings,
      monthly_revenue: monthlyRevenue || 0,
      average_rating: Math.round(avgRating * 10) / 10,
      total_reviews: totalReviews,
      popular_services: [] // Placeholder for TODO
    };
  }

  // --- Service Management ---

  async getVendorServices(vendorId, query) {
    const {
      category, is_available, status, search, min_price, max_price,
      sort_by = 'created_at', order = 'DESC', page = 1, limit = 10
    } = query;

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const offset = (parsedPage - 1) * parsedLimit;

    // Build where conditions
    const where = { vendor_id: vendorId };

    if (category) { where.category = category; }
    if (is_available !== undefined) { where.is_available = is_available === 'true'; }
    where.status = status || 'active';

    if (search) {
      where[Op.or] = [
        { service_name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (min_price || max_price) {
      where.price = {};
      if (min_price) where.price[Op.gte] = parseFloat(min_price);
      if (max_price) where.price[Op.lte] = parseFloat(max_price);
    }

    // Fetch services with ServicesMaster details
    const { count, rows: services } = await VendorService.findAndCountAll({
      where,
      include: [
        {
          model: ServicesMaster,
          as: 'ServicesMaster',
          attributes: ['service_id', 'service_name', 'service_type', 'service_description'],
          required: false
        }
      ],
      order: [[sort_by, order.toUpperCase()]],
      limit: parsedLimit,
      offset
    });

    // Calculate additional stats for each service
    const servicesWithStats = await Promise.all(services.map(async (service) => {
      const serviceData = service.toJSON();

      // Get booking count for this service
      const bookingCount = await BookingService.count({
        include: [{
          model: Booking,
          where: { 
            vendor_id: vendorId,
            booking_status: 'completed'
          }
        }],
        where: { service_id: service.service_id }
      });

      return {
        ...serviceData,
        total_bookings: bookingCount
      };
    }));
    
    return {
      services: servicesWithStats,
      pagination: {
        current_page: parsedPage,
        per_page: parsedLimit,
        total_pages: Math.ceil(count / parsedLimit),
        total_count: count
      }
    };
  }

  async getServiceById(vendorId, serviceId) {
    const service = await VendorService.findOne({
      where: { 
        vendor_id: vendorId, 
        service_id: serviceId 
      },
      include: [
        {
          model: ServicesMaster,
          as: 'ServicesMaster',
          attributes: ['service_id', 'service_name', 'service_type', 'service_description']
        }
      ]
    });

    if (!service) {
      throw new NotFoundError('Service not found or does not belong to this vendor');
    }

    // Get booking statistics
    const bookingStats = await BookingService.count({
      include: [{
        model: Booking,
        where: { vendor_id: vendorId }
      }],
      where: { service_id: serviceId }
    });

    const serviceData = {
      ...service.toJSON(),
      total_bookings: bookingStats
    };

    return serviceData;
  }

  async addOrUpdateService(vendorId, serviceData) {
    const { service_id, ...updateFields } = serviceData;

    // Verify vendor exists and is active/approved
    const vendor = await Vendor.findOne({
      where: { 
        vendor_id: vendorId,
        status: 'active',
        verification_status: 'approved'
      }
    });

    if (!vendor) {
      throw new ForbiddenError('Vendor account is not active or approved');
    }

    let vendorService = await VendorService.findOne({
      where: { vendor_id: vendorId, service_id }
    });
    
    let isNew = false;
    const detailsToSave = { 
        ...updateFields, 
        vendor_id: vendorId, 
        service_id, 
        status: 'active' 
    };

    if (vendorService) {
      // Update existing service
      await vendorService.update(detailsToSave);
    } else {
      // Create new service
      vendorService = await VendorService.create(detailsToSave);
      isNew = true;
    }

    return { vendorService, isNew };
  }

  async toggleServiceAvailability(vendorId, serviceId, isAvailable) {
    const vendorService = await VendorService.findOne({
      where: { vendor_id: vendorId, service_id: serviceId }
    });

    if (!vendorService) {
      throw new NotFoundError('Service not found or does not belong to this vendor');
    }
    
    await vendorService.update({ is_available: isAvailable });
    
    return vendorService;
  }

  async removeVendorService(vendorId, serviceId) {
    const vendorService = await VendorService.findOne({
      where: { vendor_id: vendorId, service_id: serviceId }
    });

    if (!vendorService) {
      throw new NotFoundError('Service not found or does not belong to this vendor');
    }

    // Check for existing active bookings with this service
    const hasActiveBookings = await BookingService.count({
      include: [{
        model: Booking,
        where: { 
          vendor_id: vendorId, 
          booking_status: { [Op.in]: ['confirmed', 'pending'] },
          booking_date: { [Op.gte]: new Date() }
        }
      }],
      where: { service_id: serviceId }
    });

    if (hasActiveBookings > 0) {
      throw new ValidationError(
        `Cannot remove service with ${hasActiveBookings} active bookings. Set as unavailable instead.`
      );
    }

    // Soft delete: Update status to inactive and set availability to false
    await vendorService.update({ 
      status: 'inactive',
      is_available: false
    });
  }

  async permanentlyDeleteService(vendorId, serviceId) {
    const vendorService = await VendorService.findOne({
      where: { vendor_id: vendorId, service_id: serviceId }
    });

    if (!vendorService) {
      throw new NotFoundError('Service not found or does not belong to this vendor');
    }

    // Check for any bookings (past or present)
    const totalBookings = await BookingService.count({
      include: [{
        model: Booking,
        where: { vendor_id: vendorId }
      }],
      where: { service_id: serviceId }
    });

    if (totalBookings > 0) {
      throw new ValidationError(
        `Cannot permanently delete service with booking history (${totalBookings} bookings found). Use soft delete instead.`
      );
    }

    // Hard delete
    await vendorService.destroy();
  }

  async bulkUpdateServices(vendorId, serviceIds, updates) {
    // Prevent updating critical fields
    delete updates.vendor_id;
    delete updates.service_id;
    
    // Ensure only valid updatable keys remain in updates
    const validKeys = ['service_name', 'description', 'price', 'duration', 'category', 'is_available', 'status'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => validKeys.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});
      
    if (Object.keys(filteredUpdates).length === 0) {
       throw new ValidationError('No valid fields provided for bulk update.');
    }

    const [affectedCount] = await VendorService.update(filteredUpdates, {
      where: {
        vendor_id: vendorId,
        service_id: { [Op.in]: serviceIds }
      }
    });

    return {
      affected_count: affectedCount,
      updated_fields: Object.keys(filteredUpdates)
    };
  }

  async getVendorsList() {
    const vendors = await User.findAll({
      where: { user_type: 'vendor' },
    });
    return vendors;
  }
}

module.exports = new VendordataService();