import { prisma } from "../../../config/prisma";
import { startOfDay } from "date-fns";

export class BusinessLeaveRepository {

  static async findHolidays(businessId: string, tab: "upcoming" | "running" | "completed") {
    const today = startOfDay(new Date());

    const dateFilter =
      tab === "upcoming"  ? { start_date: { gt: today } }
      : tab === "running" ? { start_date: { lte: today }, end_date: { gte: today } }
      :                     { end_date: { lt: today } };

    return prisma.holiday.findMany({
      where:   { business_id: businessId, ...dateFilter },
      include: {
        _count: { select: { staff_holidays: true } },
      },
      orderBy: { start_date: tab === "completed" ? "desc" : "asc" },
    });
  }

  static async findLeaves(businessId: string, status?: string) {
    return prisma.staffLeave.findMany({
      where: {
        staff: { business_id: businessId },
        ...(status && { status: status as any }),
      },
      include: {
        staff: {
          select: {
            id:         true,
            name:       true,
            avatar_url: true,
            email:      true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  static async findLeaveById(leaveId: string, businessId: string) {
    return prisma.staffLeave.findFirst({
      where: { id: leaveId, staff: { business_id: businessId } },
      include: {
        staff: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
