const { Sequelize, Op } = require('sequelize');
const {
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

class AdminService {

    async getCustomersList() {
        const vendors = await User.findAll({
            where: { user_type: 'vendor' },
        });
        return vendors;
    }

    async getVendorsList() {
        const vendors = await User.findAll({
            where: { user_type: 'customer' },
        });
        return vendors;
    }
}

module.exports = new AdminService();