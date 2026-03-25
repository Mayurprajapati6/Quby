import { prisma } from "../../../config/prisma";
import { startOfDay } from "date-fns";

export class StaffHolidayRepository {

  static async findForStaff(businessId: string, staffId: string, tab: "upcoming" | "running" | "completed") {
    const today = startOfDay(new Date());

    const dateFilter =
      tab === "upcoming"  ? { start_date: { gt: today } }
      : tab === "running" ? { start_date: { lte: today }, end_date: { gte: today } }
      :                     { end_date: { lt: today } };

    return prisma.holiday.findMany({
      where: {
        business_id: businessId,
        ...dateFilter,
        OR: [
          { applies_to_all_staff: true },
          { staff_holidays: { some: { staff_id: staffId } } },
        ],
      },
      orderBy: { start_date: tab === "completed" ? "desc" : "asc" },
    });
  }
}
