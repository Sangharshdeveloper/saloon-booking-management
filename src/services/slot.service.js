// src/services/slot.service.js
const VendorRepository = require('../repositories/vendor.repository');
const BookingRepository = require('../repositories/booking.repository');
const { VendorHoliday, VendorEarlyClosure } = require('../models');
const { SLOT_DURATION_MINUTES } = require('../constants');
const { NotFoundError } = require('../utils/errors');

class SlotService {
  /**
   * Check if a specific slot is available
   */
  async checkSlotAvailability(vendorId, bookingDate, startTime, endTime) {
    const vendor = await VendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    const maxCapacity = Math.min(vendor.no_of_seats, vendor.no_of_workers);

    // Count existing bookings in this time slot
    const overlappingCount = await BookingRepository.countOverlappingBookings(
      vendorId,
      bookingDate,
      startTime,
      endTime
    );

    return overlappingCount < maxCapacity;
  }

  /**
   * Get all available slots for a vendor on a specific date
   */
  async getAvailableSlots(vendorId, date) {
    const vendor = await VendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    // Check if date is a holiday
    const holiday = await VendorHoliday.findOne({
      where: { vendor_id: vendorId, holiday_date: date, status: 'active' }
    });

    if (holiday) {
      return {
        is_holiday: true,
        holiday_reason: holiday.holiday_reason,
        slots: []
      };
    }

    // Check for early closure
    const earlyClosure = await VendorEarlyClosure.findOne({
      where: { vendor_id: vendorId, closure_date: date, status: 'active' }
    });

    const openTime = vendor.open_time;
    const closeTime = earlyClosure ? earlyClosure.early_close_time : vendor.close_time;
    const breakStart = vendor.break_start_time;
    const breakEnd = vendor.break_end_time;

    const slots = [];
    let currentTime = new Date(`2000-01-01T${openTime}`);
    const endTime = new Date(`2000-01-01T${closeTime}`);

    // Generate time slots
    while (currentTime < endTime) {
      const slotStart = currentTime.toTimeString().slice(0, 5);
      currentTime.setMinutes(currentTime.getMinutes() + SLOT_DURATION_MINUTES);
      const slotEnd = currentTime.toTimeString().slice(0, 5);

      // Skip if slot end time exceeds close time
      if (currentTime > endTime) {
        break;
      }

      // Skip break time
      if (breakStart && breakEnd) {
        const breakStartTime = new Date(`2000-01-01T${breakStart}`);
        const breakEndTime = new Date(`2000-01-01T${breakEnd}`);
        const slotStartTime = new Date(`2000-01-01T${slotStart}`);
        
        if (slotStartTime >= breakStartTime && slotStartTime < breakEndTime) {
          continue;
        }
      }

      // Check availability
      const isAvailable = await this.checkSlotAvailability(
        vendorId,
        date,
        slotStart,
        slotEnd
      );
      
      slots.push({
        start_time: slotStart,
        end_time: slotEnd,
        is_available: isAvailable
      });
    }

    return {
      is_holiday: false,
      early_closure: earlyClosure ? {
        closes_at: earlyClosure.early_close_time,
        reason: earlyClosure.reason
      } : null,
      slots
    };
  }
}

module.exports = new SlotService();