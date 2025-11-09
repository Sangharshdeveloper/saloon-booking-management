// src/repositories/service.repository.js
const { VendorService, ServicesMaster } = require('../models');

class ServiceRepository {
  async findVendorService(vendorId, serviceId) {
    return await VendorService.findOne({
      where: {
        vendor_id: vendorId,
        service_id: serviceId,
        is_available: true,
        status: 'active'
      },
      include: [ServicesMaster]
    });
  }

  async findAllActive() {
    return await ServicesMaster.findAll({
      where: { status: 'active' },
      order: [['service_name', 'ASC']]
    });
  }

  async findById(serviceId) {
    return await ServicesMaster.findByPk(serviceId);
  }

  async create(serviceData) {
    return await ServicesMaster.create(serviceData);
  }

  async update(serviceId, updateData) {
    const service = await this.findById(serviceId);
    return await service.update(updateData);
  }
}

module.exports = new ServiceRepository();