import { prisma } from "../../../config/prisma";

export class ScheduleRepository {

  static async findSchedule(businessId: string) {
    return prisma.businessSchedule.findMany({
      where:   { business_id: businessId },
      orderBy: { day_of_week: "asc" },
    });
  }

  static async upsertScheduleDay(businessId: string, data: {
    day_of_week: string;
    is_open:     boolean;
    open_time?:  string;
    close_time?: string;
  }) {
    return prisma.businessSchedule.upsert({
      where: { business_id_day_of_week: { business_id: businessId, day_of_week: data.day_of_week as any } },
      create: {
        business_id: businessId,
        day_of_week: data.day_of_week as any,
        is_open:     data.is_open,
        open_time:   data.open_time  ?? "09:00",
        close_time:  data.close_time ?? "18:00",
      },
      update: {
        is_open:    data.is_open,
        open_time:  data.open_time  ?? "09:00",
        close_time: data.close_time ?? "18:00",
      },
    });
  }

  static async findHolidays(businessId: string) {
    return prisma.holiday.findMany({
      where:   { business_id: businessId },
      orderBy: { start_date: "asc" },
    });
  }

  static async findHolidayById(holidayId: string, businessId: string) {
    return prisma.holiday.findFirst({
      where: { id: holidayId, business_id: businessId },
    });
  }

  static async createHoliday(businessId: string, data: {
    holiday_name:         string;
    description?:         string;
    start_date:           Date;
    end_date:             Date;
    applies_to_all_staff: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const holiday = await tx.holiday.create({
        data: {
          business_id:          businessId,
          holiday_name:         data.holiday_name,
          description:          data.description,
          start_date:           data.start_date,
          end_date:             data.end_date,
          applies_to_all_staff: data.applies_to_all_staff,
        },
      });

      if (data.applies_to_all_staff) {
        const staff = await tx.staff.findMany({
          where:  { business_id: businessId, is_active: true },
          select: { id: true },
        });

        if (staff.length > 0) {
          await tx.staffHoliday.createMany({
            data:           staff.map((s) => ({ holiday_id: holiday.id, staff_id: s.id })),
            skipDuplicates: true,
          });
        }
      }

      return holiday;
    });
  }

  static async deleteHoliday(holidayId: string) {
    return prisma.holiday.delete({ where: { id: holidayId } });
  }
}
