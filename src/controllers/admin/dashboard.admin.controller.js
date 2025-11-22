// src/controllers/admin/dashboard.admin.controller.js

const db = require('../../config/database');
const { sendSuccessResponse, sendErrorResponse } = require('../../utils/helpers/response.helper');

class DashboardAdminController {
  // Get dashboard statistics
  async getDashboardStats(req, res) {
    try {
      const { period = '30d' } = req.query;

      let dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
      
      if (period === '7d') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
      } else if (period === '90d') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '90 days'";
      } else if (period === '1y') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '1 year'";
      }

      // Total counts
      const countsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM users WHERE user_type = 'customer' AND status != 'deleted') as total_customers,
          (SELECT COUNT(*) FROM users WHERE user_type = 'vendor' AND status != 'deleted') as total_vendors,
          (SELECT COUNT(*) FROM vendor_shops WHERE status != 'deleted') as total_shops,
          (SELECT COUNT(*) FROM bookings WHERE status != 'deleted') as total_bookings,
          (SELECT COUNT(*) FROM vendor_shops WHERE verification_status = 'pending' AND status != 'deleted') as pending_vendors,
          (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE booking_status = 'completed' AND status != 'deleted') as total_revenue
      `;

      const countsResult = await db.query(countsQuery);

      // Period statistics
      const periodQuery = `
        SELECT 
          (SELECT COUNT(*) FROM users WHERE user_type = 'customer' AND ${dateFilter} AND status != 'deleted') as new_customers,
          (SELECT COUNT(*) FROM users WHERE user_type = 'vendor' AND ${dateFilter} AND status != 'deleted') as new_vendors,
          (SELECT COUNT(*) FROM bookings WHERE ${dateFilter} AND status != 'deleted') as period_bookings,
          (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE booking_status = 'completed' AND ${dateFilter} AND status != 'deleted') as period_revenue
      `;

      const periodResult = await db.query(periodQuery);

      // Booking status distribution
      const bookingStatusQuery = `
        SELECT 
          booking_status,
          COUNT(*) as count
        FROM bookings
        WHERE status != 'deleted'
        GROUP BY booking_status
      `;

      const bookingStatusResult = await db.query(bookingStatusQuery);

      // Top vendors by bookings
      const topVendorsQuery = `
        SELECT 
          u.user_id as vendor_id,
          u.name as vendor_name,
          vs.shop_name,
          COUNT(b.booking_id) as total_bookings,
          COALESCE(SUM(b.total_amount), 0) as total_revenue,
          vs.average_rating
        FROM users u
        INNER JOIN vendor_shops vs ON u.user_id = vs.user_id AND vs.status != 'deleted'
        LEFT JOIN bookings b ON u.user_id = b.vendor_id AND b.status != 'deleted'
        WHERE u.user_type = 'vendor' 
        GROUP BY u.user_id, u.name, vs.shop_name, vs.average_rating
        ORDER BY total_bookings DESC
        LIMIT 10
      `;

      const topVendorsResult = await db.query(topVendorsQuery);

      // Recent activities
      const recentActivitiesQuery = `
        SELECT 
          'booking' as activity_type,
          b.booking_id as id,
          'New booking #' || b.booking_id as description,
          b.created_at,
          u.email as user_email,
          u.name as user_name
        FROM bookings b
        INNER JOIN users u ON b.user_id = u.user_id
        WHERE b.status != 'deleted'
        
        UNION ALL
        
        SELECT 
          'vendor' as activity_type,
          vs.shop_id as id,
          'New vendor registration: ' || vs.shop_name as description,
          vs.created_at,
          u.email as user_email,
          u.name as user_name
        FROM vendor_shops vs
        INNER JOIN users u ON vs.user_id = u.user_id
        WHERE vs.status != 'deleted'
        
        ORDER BY created_at DESC
        LIMIT 20
      `;

      const recentActivitiesResult = await db.query(recentActivitiesQuery);

      return sendSuccessResponse(res, {
        overview: {
          ...countsResult.rows[0],
          ...periodResult.rows[0]
        },
        booking_status_distribution: bookingStatusResult.rows,
        top_vendors: topVendorsResult.rows,
        recent_activities: recentActivitiesResult.rows
      }, 'Dashboard statistics retrieved successfully');
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return sendErrorResponse(res, 'Failed to fetch dashboard statistics', 500);
    }
  }

  // Get revenue analytics
  async getRevenueAnalytics(req, res) {
    try {
      const { period = '30d', group_by = 'day' } = req.query;

      let dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
      let groupFormat = "DATE(created_at)";
      
      if (period === '7d') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
        groupFormat = "DATE(created_at)";
      } else if (period === '90d') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '90 days'";
        groupFormat = group_by === 'week' ? "DATE_TRUNC('week', created_at)::date" : "DATE(created_at)";
      } else if (period === '1y') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '1 year'";
        groupFormat = "DATE_TRUNC('month', created_at)::date";
      }

      const query = `
        SELECT 
          ${groupFormat} as date,
          COUNT(*) as total_bookings,
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(CASE WHEN booking_status = 'completed' THEN 1 END) as completed_bookings,
          COUNT(CASE WHEN booking_status = 'cancelled' THEN 1 END) as cancelled_bookings
        FROM bookings
        WHERE ${dateFilter} AND status != 'deleted'
        GROUP BY ${groupFormat}
        ORDER BY date DESC
      `;

      const result = await db.query(query);

      return sendSuccessResponse(res, result, 'Revenue analytics retrieved successfully');
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
      return sendErrorResponse(res, 'Failed to fetch revenue analytics', 500);
    }
  }

  // Get user growth analytics
  async getUserGrowthAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;

      let dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
      let groupFormat = "DATE(created_at)";
      
      if (period === '7d') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
      } else if (period === '90d') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '90 days'";
      } else if (period === '1y') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '1 year'";
        groupFormat = "DATE_TRUNC('month', created_at)::date";
      }

      const query = `
        SELECT 
          ${groupFormat} as date,
          COUNT(CASE WHEN user_type = 'customer' THEN 1 END) as new_customers,
          COUNT(CASE WHEN user_type = 'vendor' THEN 1 END) as new_vendors,
          COUNT(*) as total_new_users
        FROM users
        WHERE ${dateFilter} AND status != 'deleted'
        GROUP BY ${groupFormat}
        ORDER BY date DESC
      `;

      const result = await db.query(query);

      return sendSuccessResponse(res, result.rows, 'User growth analytics retrieved successfully');
    } catch (error) {
      console.error('Error fetching user growth analytics:', error);
      return sendErrorResponse(res, 'Failed to fetch user growth analytics', 500);
    }
  }

  // Get popular services
  async getPopularServices(req, res) {
    try {
      const { limit = 10 } = req.query;
      const limitValue = parseInt(limit);

      const query = `
        SELECT 
          sm.service_id,
          sm.service_name,
          sm.service_type,
          COUNT(DISTINCT vserv.vendor_service_id) as vendor_count,
          COUNT(bs.booking_service_id) as booking_count,
          COALESCE(AVG(vserv.price), 0) as avg_price
        FROM services_master sm
        LEFT JOIN vendor_services vserv ON sm.service_id = vserv.service_id AND vserv.status != 'deleted'
        LEFT JOIN booking_services bs ON vserv.vendor_service_id = bs.service_id
        WHERE sm.status != 'deleted'
        GROUP BY sm.service_id, sm.service_name, sm.service_type
        ORDER BY booking_count DESC
        LIMIT 1
      `;

      const result = await db.query(query, [limitValue]);

      return sendSuccessResponse(res, result, 'Popular services retrieved successfully');
    } catch (error) {
      console.error('Error fetching popular services:', error);
      return sendErrorResponse(res, 'Failed to fetch popular services', 500);
    }
  }

  // Get city-wise statistics
  async getCityWiseStats(req, res) {
    try {
      const query = `
        SELECT 
          vs.city,
          COUNT(DISTINCT vs.shop_id) as total_shops,
          COUNT(DISTINCT vs.user_id) as total_vendors,
          COUNT(DISTINCT b.booking_id) as total_bookings,
          COALESCE(SUM(b.total_amount), 0) as total_revenue
        FROM vendor_shops vs
        LEFT JOIN bookings b ON vs.user_id = b.vendor_id AND b.status != 'deleted'
        WHERE vs.status != 'deleted' AND vs.city IS NOT NULL
        GROUP BY vs.city
        ORDER BY total_bookings DESC
      `;

      const result = await db.query(query);

      return sendSuccessResponse(res, result.rows, 'City-wise statistics retrieved successfully');
    } catch (error) {
      console.error('Error fetching city-wise stats:', error);
      return sendErrorResponse(res, 'Failed to fetch city-wise statistics', 500);
    }
  }

  // Get bookings overview
  async getBookingsOverview(req, res) {
    try {
      const { period = '30d' } = req.query;

      let dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
      
      if (period === '7d') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
      } else if (period === '90d') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '90 days'";
      } else if (period === '1y') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '1 year'";
      }

      const query = `
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN booking_status = 'pending' THEN 1 END) as pending_bookings,
          COUNT(CASE WHEN booking_status = 'confirmed' THEN 1 END) as confirmed_bookings,
          COUNT(CASE WHEN booking_status = 'completed' THEN 1 END) as completed_bookings,
          COUNT(CASE WHEN booking_status = 'cancelled' THEN 1 END) as cancelled_bookings,
          COALESCE(AVG(total_amount), 0) as avg_booking_amount,
          COALESCE(SUM(CASE WHEN booking_status = 'completed' THEN total_amount END), 0) as completed_revenue
        FROM bookings
        WHERE ${dateFilter} AND status != 'deleted'
      `;

      const result = await db.query(query);

      return sendSuccessResponse(res, result.rows[0], 'Bookings overview retrieved successfully');
    } catch (error) {
      console.error('Error fetching bookings overview:', error);
      return sendErrorResponse(res, 'Failed to fetch bookings overview', 500);
    }
  }
}

module.exports = new DashboardAdminController();