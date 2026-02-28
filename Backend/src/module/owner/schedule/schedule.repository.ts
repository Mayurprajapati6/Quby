import { prisma } from "../../../config/prisma";

export class ScheduleRepository {

  static async getSchedule(businessId: string) {
    return prisma.businessSchedule.findMany({
      where:   { business_id: businessId },
      orderBy: { day_of_week: "asc" },
    });
  }

  static async updateSchedule(businessId: string, schedules: Array<{
    day_of_week: string;
    is_open:     boolean;
    open_time?:  string;
    close_time?: string;
  }>) {
    return prisma.$transaction(
      schedules.map((s) =>
        prisma.businessSchedule.upsert({
          where:  { business_id_day_of_week: { business_id: businessId, day_of_week: s.day_of_week as any } },
          update: { is_open: s.is_open, open_time: s.open_time ?? null, close_time: s.close_time ?? null },
          create: { business_id: businessId, day_of_week: s.day_of_week as any, is_open: s.is_open, open_time: s.open_time ?? null, close_time: s.close_time ?? null },
        })
      )
    );
  }

  static async getHolidays(businessId: string) {
    return prisma.holiday.findMany({
      where:   { business_id: businessId },
      orderBy: { start_date: "asc" },
    });
  }

  static async findHoliday(holidayId: string, businessId: string) {
    return prisma.holiday.findFirst({ where: { id: holidayId, business_id: businessId } });
  }

  static async countBookingsInDateRange(businessId: string, startDate: Date, endDate: Date): Promise<number> {
    return prisma.booking.count({
      where: {
        business_id:  businessId,
        status:       "CONFIRMED",
        service_date: { gte: startDate, lte: endDate },
      },
    });
  }

  static async createHoliday(data: {
    businessId:         string;
    holiday_name:       string;
    description?:       string;
    start_date:         Date;
    end_date:           Date;
    applies_to_all_staff: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const holiday = await tx.holiday.create({
        data: {
          business_id:          data.businessId,
          holiday_name:         data.holiday_name,
          description:          data.description,
          start_date:           data.start_date,
          end_date:             data.end_date,
          applies_to_all_staff: data.applies_to_all_staff,
        },
      });

      if (data.applies_to_all_staff) {
        const activeStaff = await tx.staff.findMany({
          where:  { business_id: data.businessId, is_active: true },
          select: { id: true },
        });

        if (activeStaff.length > 0) {
          await tx.staffHoliday.createMany({
            data: activeStaff.map((s) => ({
              holiday_id: holiday.id,
              staff_id:   s.id,
            })),
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