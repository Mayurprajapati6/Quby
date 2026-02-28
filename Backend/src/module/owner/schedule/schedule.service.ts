import { ScheduleRepository } from "./schedule.repository";
import { BusinessRepository } from "../business/business.repository";
import { redisClient } from "../../../config/redis";
import { NotFoundError, BadRequestError } from "../../../utils/errors/app.error";
import { BUSINESS_MESSAGES, SCHEDULE_MESSAGES } from "../../../constants/messages";
import logger from "../../../config/logger.config";

async function invalidateBusinessCache(slug: string) {
  try { await redisClient.del(`cache:business:${slug}`); }
  catch (err) { logger.warn("[Schedule] Cache invalidation failed:", err); }
}

export class ScheduleService {

  private static async verifyOwnership(businessId: string, ownerId: string) {
    const business = await BusinessRepository.findByOwnerAndId(businessId, ownerId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);
    return business;
  }

  static async getSchedule(businessId: string, ownerId: string) {
    await this.verifyOwnership(businessId, ownerId);
    return ScheduleRepository.getSchedule(businessId);
  }

  static async updateSchedule(businessId: string, ownerId: string, schedules: Array<{
    day_of_week: string;
    is_open:     boolean;
    open_time?:  string;
    close_time?: string;
  }>) {
    const business = await this.verifyOwnership(businessId, ownerId);
    await ScheduleRepository.updateSchedule(businessId, schedules);
    await invalidateBusinessCache(business.slug);
    return ScheduleRepository.getSchedule(businessId);
  }

  static async getHolidays(businessId: string, ownerId: string) {
    await this.verifyOwnership(businessId, ownerId);
    return ScheduleRepository.getHolidays(businessId);
  }

  static async createHoliday(businessId: string, ownerId: string, data: {
    holiday_name:         string;
    description?:         string;
    start_date:           string;
    end_date:             string;
    applies_to_all_staff: boolean;
  }) {
    const business = await this.verifyOwnership(businessId, ownerId);

    const startDate = new Date(data.start_date);
    const endDate   = new Date(data.end_date);

    const conflictCount = await ScheduleRepository.countBookingsInDateRange(
      businessId,
      startDate,
      endDate
    );

    if (conflictCount > 0) {
      throw new BadRequestError(
        `${SCHEDULE_MESSAGES.HOLIDAY_CONFLICT_BOOKINGS} (${conflictCount} booking${conflictCount > 1 ? "s" : ""} affected)`
      );
    }

    const holiday = await ScheduleRepository.createHoliday({
      businessId,
      holiday_name:         data.holiday_name,
      description:          data.description,
      start_date:           startDate,
      end_date:             endDate,
      applies_to_all_staff: data.applies_to_all_staff,
    });

    await invalidateBusinessCache(business.slug);
    return holiday;
  }

  static async deleteHoliday(businessId: string, holidayId: string, ownerId: string) {
    const business = await this.verifyOwnership(businessId, ownerId);
    const holiday  = await ScheduleRepository.findHoliday(holidayId, businessId);
    if (!holiday) throw new NotFoundError(SCHEDULE_MESSAGES.HOLIDAY_NOT_FOUND);

    await ScheduleRepository.deleteHoliday(holidayId);
    await invalidateBusinessCache(business.slug);
  }
}