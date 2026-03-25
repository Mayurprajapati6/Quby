import { ScheduleRepository } from "./schedule.repository";
import { OwnerBusinessRepository }  from "../business/business.repository";
import { prisma } from "../../../config/prisma";
import { queueEmail } from "../../../services/email.services";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import { startOfDay } from "date-fns";
import type {
  ScheduleItemDTO,
  UpdateScheduleDTO,
  HolidayItemDTO,
  CreateHolidayDTO,
} from "./schedule.types";

export class ScheduleService {

  private static async resolveOwnerId(userId: string): Promise<string> {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");
    return owner.id;
  }

  private static async getOwnedBusiness(userId: string, businessId: string) {
    const ownerId  = await this.resolveOwnerId(userId);
    const business = await OwnerBusinessRepository.findByOwnerAndId(ownerId, businessId);
    if (!business) throw new ForbiddenError("Business not found or access denied.");
    return business;
  }

  static async getSchedule(ownerId: string, businessId: string): Promise<ScheduleItemDTO[]> {
    const business  = await this.getOwnedBusiness(ownerId, businessId);
    const schedules = await ScheduleRepository.findSchedule(business.id);
    return schedules.map((s) => ({
      id:          s.id,
      day_of_week: s.day_of_week,
      is_open:     s.is_open,
      open_time:   s.open_time,
      close_time:  s.close_time,
    }));
  }

  static async updateSchedule(ownerId: string, businessId: string, dto: UpdateScheduleDTO): Promise<ScheduleItemDTO[]> {
    const business = await this.getOwnedBusiness(ownerId, businessId);

    for (const s of dto.schedules) {
      if (s.is_open && (!s.open_time || !s.close_time)) {
        throw new BadRequestError(
          `${s.day_of_week}: open days must have open_time and close_time.`
        );
      }
    }

    await Promise.all(
      dto.schedules.map((s) =>
        ScheduleRepository.upsertScheduleDay(business.id, s)
      )
    );

    return this.getSchedule(ownerId, businessId);
  }

  static async getHolidays(ownerId: string, businessId: string): Promise<HolidayItemDTO[]> {
    const business = await this.getOwnedBusiness(ownerId, businessId);
    const holidays = await ScheduleRepository.findHolidays(business.id);

    return holidays.map((h) => ({
      id:                   h.id,
      holiday_name:         h.holiday_name,
      description:          h.description,
      start_date:           h.start_date,
      end_date:             h.end_date,
      applies_to_all_staff: h.applies_to_all_staff,
      created_by_role:      "OWNER",
      affected_staff_count: (h as any).staff_holidays?.length ?? 0,
    }));
  }

  static async createHoliday(ownerId: string, businessId: string, dto: CreateHolidayDTO): Promise<HolidayItemDTO> {
    const business = await this.getOwnedBusiness(ownerId, businessId);

    const startDate = startOfDay(new Date(dto.start_date));
    const endDate   = startOfDay(new Date(dto.end_date));
    const today     = startOfDay(new Date());

    if (startDate < today) {
      throw new BadRequestError("Holiday start date cannot be in the past.");
    }
    if (endDate < startDate) {
      throw new BadRequestError("End date must be on or after start date.");
    }

    const holiday = await ScheduleRepository.createHoliday(business.id, {
      holiday_name:         dto.holiday_name,
      description:          dto.description,
      start_date:           startDate,
      end_date:             endDate,
      applies_to_all_staff: dto.applies_to_all_staff,
    });

    queueEmail({
      to:   `${business.id}@notify`,
      type: "business-holiday",
      data: {
        businessName: business.business_name,
        holidayName:  dto.holiday_name,
        startDate:    dto.start_date,
        endDate:      dto.end_date,
        description:  dto.description ?? "",
      },
    }).catch((err) => logger.warn("[Schedule] Holiday email failed:", err));

    return {
      id:                   holiday.id,
      holiday_name:         holiday.holiday_name,
      description:          holiday.description,
      start_date:           holiday.start_date,
      end_date:             holiday.end_date,
      applies_to_all_staff: holiday.applies_to_all_staff,
      created_by_role:      "OWNER",
      affected_staff_count: 0,
    };
  }

  static async deleteHoliday(ownerId: string, businessId: string, holidayId: string): Promise<void> {
    const business = await this.getOwnedBusiness(ownerId, businessId);
    const holiday  = await ScheduleRepository.findHolidayById(holidayId, business.id);
    if (!holiday) throw new NotFoundError("Holiday not found.");
    await ScheduleRepository.deleteHoliday(holidayId);
  }
}