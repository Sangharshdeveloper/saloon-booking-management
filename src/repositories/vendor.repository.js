// src/repositories/vendor.repository.js
const { Op } = require('sequelize');
const { Vendor, VendorService, VendorImage, ServicesMaster, Review } = require('../models');

class VendorRepository {
  async findById(vendorId) {
    return await Vendor.findByPk(vendorId);
  }

  async findActiveVendor(vendorId) {
    return await Vendor.findOne({
      where: {
        vendor_id: vendorId,
        verification_status: 'approved',
        status: 'active'
      }
    });
  }

  async findByPhoneNumber(phoneNumber) {
    return await Vendor.findOne({ where: { phone_number: phoneNumber } });
  }

  async create(vendorData) {
    return await Vendor.create(vendorData);
  }

  async update(vendorId, updateData) {
    const vendor = await this.findById(vendorId);
    return await vendor.update(updateData);
  }

  async findWithDetails(vendorId) {
    return await Vendor.findOne({
      where: {
        vendor_id: vendorId,
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
          limit: 10,
          order: [['created_at', 'DESC']],
          required: false
        }
      ]
    });
  }
}

module.exports = new VendorRepository();