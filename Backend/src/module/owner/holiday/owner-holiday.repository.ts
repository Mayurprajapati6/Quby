import { prisma } from "../../../config/prisma";
import { startOfDay } from "date-fns";

const HOLIDAY_INCLUDE = {
  business: { select: { id: true, business_name: true } },
  staff_holidays: { include: { staff: { select: { id: true, name: true } } } },
} as const;

export class OwnerHolidayRepository {

  static async findByTab(businessIds: string[], tab: "upcoming" | "running" | "completed") {
    const today = startOfDay(new Date());

    const dateFilter =
      tab === "upcoming"  ? { start_date: { gt: today } }
      : tab === "running" ? { start_date: { lte: today }, end_date: { gte: today } }
      :                     { end_date: { lt: today } };

    return prisma.holiday.findMany({
      where:   { business_id: { in: businessIds }, ...dateFilter },
      include: HOLIDAY_INCLUDE,
      orderBy: { start_date: tab === "completed" ? "desc" : "asc" },
    });
  }

  static async findByIdAndOwner(holidayId: string, businessIds: string[]) {
    return prisma.holiday.findFirst({
      where:   { id: holidayId, business_id: { in: businessIds } },
      include: HOLIDAY_INCLUDE,
    });
  }

  static async create(data: {
    business_id:           string;
    holiday_name:          string;
    description?:          string;
    start_date:            Date;
    end_date:              Date;
    applies_to_all_staff:  boolean;
    staff_ids?:            string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const holiday = await tx.holiday.create({
        data: {
          business_id:          data.business_id,
          holiday_name:         data.holiday_name,
          description:          data.description ?? null,
          start_date:           data.start_date,
          end_date:             data.end_date,
          applies_to_all_staff: data.applies_to_all_staff,
        },
      });

      if (!data.applies_to_all_staff && data.staff_ids?.length) {
        await tx.staffHoliday.createMany({
          data: data.staff_ids.map(sid => ({
            holiday_id: holiday.id,
            staff_id:   sid,
          })),
          skipDuplicates: true,
        });
      }

      return holiday;
    });
  }

  static async update(
    holidayId: string,
    data: {
      holiday_name?:         string;
      description?:          string;
      start_date?:           Date;
      end_date?:             Date;
      applies_to_all_staff?: boolean;
      staff_ids?:            string[];
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const { staff_ids, ...fields } = data;

      const holiday = await tx.holiday.update({
        where: { id: holidayId },
        data:  fields,
      });

      if (staff_ids !== undefined) {
        await tx.staffHoliday.deleteMany({ where: { holiday_id: holidayId } });

        if (!holiday.applies_to_all_staff && staff_ids.length) {
          await tx.staffHoliday.createMany({
            data: staff_ids.map(sid => ({
              holiday_id: holidayId,
              staff_id:   sid,
            })),
            skipDuplicates: true,
          });
        }
      }

      return holiday;
    });
  }

  static async delete(holidayId: string) {
    return prisma.holiday.delete({ where: { id: holidayId } });
  }

  static async getStaffForBusiness(businessId: string) {
    return prisma.staff.findMany({
      where:  { business_id: businessId, is_active: true },
      select: { id: true, name: true, email: true, user: { select: { id: true } } },
    });
  }
}
