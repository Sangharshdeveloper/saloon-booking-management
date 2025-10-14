const { Op } = require('sequelize');
const { 
  Vendor, 
  VendorService, 
  VendorImage, 
  ServicesMaster, 
  VendorHoliday,
  VendorEarlyClosure,
  Review,
  Booking
} = require('../models');

class VendorsController {

  // Search vendors by filters
  async searchVendors(req, res, next) {
    try {
      const {
        city,
        service_type,
        rating,
        sort_by = 'rating',
        page = 1,
        limit = 10,
        search
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Build where conditions
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
          where: { status: 'active', is_available: true },
          include: [ServicesMaster],
          required: false
        },
        {
          model: VendorImage,
          where: { status: 'active' },
          required: false
        },
        {
          model: Review,
          required: false,
          attributes: ['rating']
        }
      ];

      // Filter by service type
      if (service_type) {
        includeConditions[0].include[0].where = {
          service_name: { [Op.iLike]: `%${service_type}%` }
        };
        includeConditions[0].required = true;
      }

      const { count, rows: vendors } = await Vendor.findAndCountAll({
        where: whereConditions,
        include: includeConditions,
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      // Calculate additional fields for each vendor
      const vendorsWithStats = await Promise.all(vendors.map(async (vendor) => {
        const vendorData = vendor.toJSON();
        
        // Calculate average rating
        const avgRating = vendor.Reviews.length > 0 
          ? vendor.Reviews.reduce((sum, review) => sum + review.rating, 0) / vendor.Reviews.length 
          : 0;
        
        // Get minimum service price
        const minPrice = vendor.VendorServices.length > 0 
          ? Math.min(...vendor.VendorServices.map(service => parseFloat(service.price)))
          : 0;
        
        // Get booking count (for most_booked sort)
        const bookingCount = await Booking.count({
          where: { 
            vendor_id: vendor.vendor_id,
            booking_status: 'completed'
          }
        });

        // Get primary image
        const primaryImage = vendor.VendorImages.find(img => img.image_type === 'homepage') ||
                            vendor.VendorImages[0];

        return {
          ...vendorData,
          average_rating: Math.round(avgRating * 10) / 10,
          total_reviews: vendor.Reviews.length,
          min_price: minPrice,
          booking_count: bookingCount,
          primary_image: primaryImage?.image_url || null,
          total_images: vendor.VendorImages.length
        };
      }));

      // Apply sorting
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

      // Apply rating filter after calculating
      const filteredVendors = rating 
        ? vendorsWithStats.filter(vendor => vendor.average_rating >= parseFloat(rating))
        : vendorsWithStats;

      res.json({
        success: true,
        data: {
          vendors: filteredVendors,
          pagination: {
            current_page: parseInt(page),
            total_pages: Math.ceil(count / parseInt(limit)),
            total_count: count,
            per_page: parseInt(limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update vendor profile
  async updateProfile(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const updateData = { ...req.body };

      // Remove fields that cannot be updated
      delete updateData.phone_number;
      delete updateData.verification_status;

      const vendor = await Vendor.findByPk(vendor_id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      await vendor.update(updateData);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { vendor }
      });
    } catch (error) {
      next(error);
    }
  }

  // Upload vendor images
  async uploadImages(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No images uploaded'
        });
      }

      const vendor_id = req.user.userId;
      const { image_type = 'gallery' } = req.body;

      // If uploading homepage image, remove existing homepage image
      if (image_type === 'homepage') {
        await VendorImage.update(
          { image_type: 'gallery' },
          { where: { vendor_id, image_type: 'homepage' } }
        );
      }

      const uploadedImages = await Promise.all(
        req.files.map(async (file, index) => {
          return await VendorImage.create({
            vendor_id,
            image_url: `/uploads/vendors/${file.filename}`,
            image_type: image_type === 'homepage' && index === 0 ? 'homepage' : 'gallery',
            is_primary: image_type === 'homepage' && index === 0
          });
        })
      );

      res.json({
        success: true,
        message: 'Images uploaded successfully',
        data: { images: uploadedImages }
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete vendor image
  async deleteImage(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { image_id } = req.params;

      const image = await VendorImage.findOne({
        where: { image_id, vendor_id }
      });

      if (!image) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }

      await image.destroy();

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Add holiday dates
  async addHoliday(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { holiday_date, holiday_reason } = req.body;

      // Check if holiday already exists
      const existingHoliday = await VendorHoliday.findOne({
        where: { vendor_id, holiday_date }
      });

      if (existingHoliday) {
        return res.status(409).json({
          success: false,
          message: 'Holiday already exists for this date'
        });
      }

      const holiday = await VendorHoliday.create({
        vendor_id,
        holiday_date,
        holiday_reason
      });

      // TODO: Cancel existing bookings for this date and notify customers

      res.status(201).json({
        success: true,
        message: 'Holiday added successfully',
        data: { holiday }
      });
    } catch (error) {
      next(error);
    }
  }

  // Set early closure for a date
  async setEarlyClosure(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { closure_date, early_close_time, reason } = req.body;

      // Validate early close time is before regular close time
      const vendor = await Vendor.findByPk(vendor_id);
      if (early_close_time >= vendor.close_time) {
        return res.status(400).json({
          success: false,
          message: 'Early close time must be before regular close time'
        });
      }

      const [earlyClosure, created] = await VendorEarlyClosure.findOrCreate({
        where: { vendor_id, closure_date },
        defaults: {
          vendor_id,
          closure_date,
          early_close_time,
          reason
        }
      });

      if (!created) {
        await earlyClosure.update({
          early_close_time,
          reason
        });
      }

      // TODO: Cancel bookings affected by early closure and notify customers

      res.status(created ? 201 : 200).json({
        success: true,
        message: created ? 'Early closure set successfully' : 'Early closure updated successfully',
        data: { early_closure: earlyClosure }
      });
    } catch (error) {
      next(error);
    }
  }

  // Deactivate vendor account
  async deactivateAccount(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { reason } = req.body;

      // Check for upcoming confirmed bookings
      const upcomingBookings = await Booking.count({
        where: {
          vendor_id,
          booking_status: 'confirmed',
          booking_date: { [Op.gte]: new Date() }
        }
      });

      if (upcomingBookings > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deactivate account with ${upcomingBookings} upcoming bookings. Please handle them first.`
        });
      }

      const vendor = await Vendor.findByPk(vendor_id);
      await vendor.update({
        status: 'inactive',
        admin_comments: reason ? `Deactivated by vendor. Reason: ${reason}` : 'Deactivated by vendor'
      });

      res.json({
        success: true,
        message: 'Account deactivated successfully. You can contact admin to reactivate.'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get vendor dashboard statistics
  async getDashboardStats(req, res, next) {
    try {
      const vendor_id = req.user.user_id;
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get various statistics
      const [
        totalBookings,
        todaysBookings,
        completedBookings,
        monthlyRevenue
      ] = await Promise.all([
        Booking.count({ where: { vendor_id } }),
        Booking.count({ 
          where: { 
            vendor_id, 
            booking_date: today.toISOString().split('T')[0],
            booking_status: ['confirmed', 'completed']
          } 
        }),
        Booking.count({ 
          where: { 
            vendor_id, 
            booking_status: 'completed' 
          } 
        }),
        Booking.sum('total_amount', {
          where: {
            vendor_id,
            booking_status: 'completed',
            created_at: { [Op.gte]: thirtyDaysAgo }
          }
        })
      ]);

      res.json({
        success: true,
        message: "Dashboard Loaded",
        data: {
          total_bookings: totalBookings,
          todays_bookings: todaysBookings,
          completed_bookings: completedBookings,
          monthly_revenue: monthlyRevenue || 0,
          average_rating: 0,
          total_reviews: 0,
          popular_services: []
        }
      });
    } catch (error) {
      next(error);
    }
  }

// Get Vendor Services List
  async getVendorServices(req, res, next) {
    try {
      const vendor_id = req.user.userId; // From auth middleware

      const {
        category,
        is_available,
        status,
        search,
        min_price,
        max_price,
        sort_by = 'created_at',
        order = 'DESC',
        page = 1,
        limit = 10
      } = req.query;

      // Build where conditions
      const where = { vendor_id };

      // Filter by category
      if (category) {
        where.category = category;
      }

      // Filter by availability
      if (is_available !== undefined) {
        where.is_available = is_available === 'true';
      }

      // Filter by status
      if (status) {
        where.status = status;
      } else {
        // Default: only show active services
        where.status = 'active';
      }

      // Search in service name and description
      if (search) {
        where[Op.or] = [
          { service_name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Price range filter
      if (min_price || max_price) {
        where.price = {};
        if (min_price) where.price[Op.gte] = parseFloat(min_price);
        if (max_price) where.price[Op.lte] = parseFloat(max_price);
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Fetch services with ServicesMaster details
      const { count, rows: services } = await VendorService.findAndCountAll({
        where,
        include: [
          {
            model: ServicesMaster,
            attributes: ['service_id', 'service_name', 'service_type', 'service_description'],
            required: false
          }
        ],
        order: [[sort_by, order.toUpperCase()]],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Calculate additional stats for each service
      const servicesWithStats = await Promise.all(services.map(async (service) => {
        const serviceData = service.toJSON();

        // Get booking count for this service
        const bookingCount = await BookingService.count({
          include: [{
            model: Booking,
            where: { 
              vendor_id,
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

      res.status(200).json({
        success: true,
        message: 'Services retrieved successfully',
        data: {
          services: servicesWithStats,
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_pages: Math.ceil(count / parseInt(limit)),
            total_count: count
          }
        }
      });
    } catch (error) {
      console.error('Error fetching vendor services:', error);
      next(error);
    }
  }


  // Get single service details
  async getServiceById(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { service_id } = req.params;

      const service = await VendorService.findOne({
        where: { 
          vendor_id, 
          service_id 
        },
        include: [
          {
            model: ServicesMaster,
            attributes: ['service_id', 'service_name', 'service_type', 'service_description']
          }
        ]
      });

      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      // Get booking statistics
      const bookingStats = await BookingService.count({
        include: [{
          model: Booking,
          where: { vendor_id }
        }],
        where: { service_id }
      });

      const serviceData = {
        ...service.toJSON(),
        total_bookings: bookingStats
      };

      res.json({
        success: true,
        data: { service: serviceData }
      });
    } catch (error) {
      next(error);
    }
  }

  // Add or update vendor service
  async addOrUpdateService(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const {
        service_id, // From ServicesMaster
        service_name,
        description,
        price,
        duration,
        category,
        is_available = true
      } = req.body;

      // Verify vendor exists and is active
      const vendor = await Vendor.findOne({
        where: { 
          vendor_id,
          status: 'active',
          verification_status: 'approved'
        }
      });

      if (!vendor) {
        return res.status(403).json({
          success: false,
          message: 'Vendor account is not active or approved'
        });
      }

      // Check if service already exists
      let vendorService = await VendorService.findOne({
        where: { vendor_id, service_id }
      });

      if (vendorService) {
        // Update existing service
        await vendorService.update({
          service_name,
          description,
          price,
          duration,
          category,
          is_available
        });

        return res.json({
          success: true,
          message: 'Service updated successfully',
          data: { service: vendorService }
        });
      } else {
        // Create new service
        vendorService = await VendorService.create({
          vendor_id,
          service_id,
          service_name,
          description,
          price,
          duration,
          category,
          is_available,
          status: 'active'
        });

        return res.status(201).json({
          success: true,
          message: 'Service added successfully',
          data: { service: vendorService }
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // Toggle service availability
  async toggleServiceAvailability(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { service_id } = req.params;
      const { is_available } = req.body;

      const vendorService = await VendorService.findOne({
        where: { vendor_id, service_id }
      });

      if (!vendorService) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      await vendorService.update({ is_available });

      res.json({
        success: true,
        message: `Service ${is_available ? 'enabled' : 'disabled'} successfully`,
        data: { service: vendorService }
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete/Remove Vendor Service
  async removeVendorService(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { service_id } = req.params;

      const vendorService = await VendorService.findOne({
        where: { vendor_id, service_id }
      });

      if (!vendorService) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      // Check for existing active bookings with this service
      const hasActiveBookings = await BookingService.count({
        include: [{
          model: Booking,
          where: { 
            vendor_id, 
            booking_status: ['confirmed', 'pending'],
            booking_date: { [Op.gte]: new Date() }
          }
        }],
        where: { service_id }
      });

      if (hasActiveBookings > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove service with active bookings. Set as unavailable instead.',
          data: {
            active_bookings: hasActiveBookings,
            suggestion: 'Use PATCH /api/vendors/services/:service_id/availability to disable this service'
          }
        });
      }

      // Soft delete: Update status to inactive
      await vendorService.update({ 
        status: 'inactive',
        is_available: false
      });

      res.json({
        success: true,
        message: 'Service removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Permanently delete service (hard delete - admin or vendor)
  async permanentlyDeleteService(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { service_id } = req.params;

      const vendorService = await VendorService.findOne({
        where: { vendor_id, service_id }
      });

      if (!vendorService) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      // Check for any bookings (past or present)
      const totalBookings = await BookingService.count({
        include: [{
          model: Booking,
          where: { vendor_id }
        }],
        where: { service_id }
      });

      if (totalBookings > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot permanently delete service with booking history (${totalBookings} bookings found)`,
          data: { 
            total_bookings: totalBookings,
            suggestion: 'Use soft delete (set status to inactive) instead'
          }
        });
      }

      // Hard delete
      await vendorService.destroy();

      res.json({
        success: true,
        message: 'Service permanently deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk update services (e.g., price adjustment, availability toggle)
  async bulkUpdateServices(req, res, next) {
    try {
      const vendor_id = req.user.userId;
      const { service_ids, updates } = req.body;

      if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'service_ids array is required'
        });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'updates object is required'
        });
      }

      // Prevent updating critical fields
      delete updates.vendor_id;
      delete updates.service_id;

      const [affectedCount] = await VendorService.update(updates, {
        where: {
          vendor_id,
          service_id: { [Op.in]: service_ids }
        }
      });

      res.json({
        success: true,
        message: `${affectedCount} service(s) updated successfully`,
        data: {
          affected_count: affectedCount,
          updated_fields: Object.keys(updates)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get vendor details by ID
  async getVendorById(req, res, next) {
    try {
      const { vendor_id } = req.params;

      const vendor = await Vendor.findOne({
        where: { 
          vendor_id,
          verification_status: 'approved',
          status: 'active'
        },
        include: [
          {
            model: VendorService,
            where: { status: 'active', is_available: true },
            include: [ServicesMaster],
            required: false
          },
          {
            model: VendorImage,
            where: { status: 'active' },
            required: false
          },
          {
            model: Review,
            include: [{
              model: User,
              attributes: ['user_id', 'name', 'email']
            }],
            limit: 10,
            order: [['created_at', 'DESC']],
            required: false
          }
        ]
      });

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      // Calculate additional stats
      const totalReviews = await Review.count({
        where: { vendor_id }
      });

      const avgRating = vendor.Reviews.length > 0 
        ? vendor.Reviews.reduce((sum, review) => sum + review.rating, 0) / vendor.Reviews.length 
        : 0;

      const vendorData = {
        ...vendor.toJSON(),
        average_rating: Math.round(avgRating * 10) / 10,
        total_reviews: totalReviews
      };

      res.json({
        success: true,
        data: { vendor: vendorData }
      });
    } catch (error) {
      next(error);
    }
  }
  // Delete/Remove vendor (Soft delete - set status to deleted)
  async removeVendor(req, res, next) {
    try {
      const { vendor_id } = req.params;
      const requestingUserId = req.user.userId;
      const userRole = req.user.role;

      // Find vendor
      const vendor = await Vendor.findByPk(vendor_id);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      // Authorization check: Only admin or the vendor themselves can delete
      if (userRole !== 'admin' && requestingUserId !== vendor_id) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to delete this vendor'
        });
      }

      // Check for active/confirmed bookings
      const activeBookings = await Booking.count({
        where: {
          vendor_id,
          booking_status: ['confirmed', 'pending'],
          booking_date: { [Op.gte]: new Date() }
        }
      });

      if (activeBookings > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete vendor with ${activeBookings} active bookings. Please complete or cancel them first.`,
          data: { active_bookings: activeBookings }
        });
      }

      // Soft delete - update status instead of actual deletion
      await vendor.update({
        status: 'deleted',
        admin_comments: `Deleted by ${userRole} on ${new Date().toISOString()}`
      });

      // Also deactivate all vendor services
      await VendorService.update(
        { status: 'inactive', is_available: false },
        { where: { vendor_id } }
      );

      res.json({
        success: true,
        message: 'Vendor deleted successfully',
        data: { 
          vendor_id,
          deleted_at: new Date()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Permanently delete vendor (Hard delete - admin only)
  async permanentlyDeleteVendor(req, res, next) {
    try {
      const { vendor_id } = req.params;
      const userRole = req.user.role;

      // Only admin can permanently delete
      if (userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can permanently delete vendors'
        });
      }

      const vendor = await Vendor.findByPk(vendor_id);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      // Check for any bookings (completed, cancelled, etc.)
      const totalBookings = await Booking.count({
        where: { vendor_id }
      });

      if (totalBookings > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot permanently delete vendor with booking history (${totalBookings} bookings found). Consider soft delete instead.`,
          data: { total_bookings: totalBookings }
        });
      }

      // Delete related records first (cascade delete)
      await Promise.all([
        VendorService.destroy({ where: { vendor_id } }),
        VendorImage.destroy({ where: { vendor_id } }),
        VendorHoliday.destroy({ where: { vendor_id } }),
        VendorEarlyClosure.destroy({ where: { vendor_id } }),
        Review.destroy({ where: { vendor_id } })
      ]);

      // Finally delete vendor
      await vendor.destroy();

      res.json({
        success: true,
        message: 'Vendor permanently deleted successfully',
        data: { 
          vendor_id,
          deleted_at: new Date()
        }
      });
    } catch (error) {
      next(error);
    }
  }

}

module.exports = new VendorsController();