import { prisma } from "../../../config/prisma";
import { startOfDay, startOfMonth, endOfMonth } from "date-fns";

export class BusinessStaffRepository {

  static async findAll(businessId: string) {
    const today = startOfDay(new Date());
    return prisma.staff.findMany({
      where:   { business_id: businessId },
      include: {
        _count: { select: { bookings: { where: { service_date: today } } } },
      },
      orderBy: [{ is_active: "desc" }, { name: "asc" }],
    });
  }

  static async findById(staffId: string, businessId: string) {
    return prisma.staff.findFirst({
      where:   { id: staffId, business_id: businessId },
      include: {
        services: {
          include: {
            service_offering: {
              include: { platform_service: { select: { id: true, name: true, category: true } } },
            },
          },
        },
        schedules: { orderBy: { day_of_week: "asc" } },
        _count:    { select: { bookings: { where: { service_date: startOfDay(new Date()) } } } },
      },
    });
  }

  static async getMonthStats(staffId: string) {
    const start = startOfMonth(new Date());
    const end   = endOfMonth(new Date());

    const bookings = await prisma.booking.findMany({
      where:  { staff_id: staffId, service_date: { gte: start, lte: end } },
      select: { status: true, service_amount: true },
    });

    const completed = bookings.filter(b => b.status === "COMPLETED");
    const cancelled = bookings.filter(b =>
      ["CANCELLED", "NO_SHOW"].includes(b.status)
    );
    const revenue   = completed.reduce((s, b) => s + b.service_amount, 0);
    const denom     = completed.length + cancelled.length;
    const accuracy  = denom > 0 ? Math.round(completed.length / denom * 100) : 100;

    return {
      total_bookings:     bookings.length,
      completed_bookings: completed.length,
      cancelled_bookings: cancelled.length,
      revenue_inr:        revenue / 100,
      accuracy_percent:   accuracy,
    };
  }

  static async upsertSchedule(staffId: string, schedules: Array<{
    day_of_week:  string;
    is_available: boolean;
    start_time?:  string;
    end_time?:    string;
  }>) {
    return prisma.$transaction(
      schedules.map(s =>
        prisma.staffSchedule.upsert({
          where: {
            staff_id_day_of_week: {
              staff_id:    staffId,
              day_of_week: s.day_of_week as any,
            },
          },
          create: {
            staff_id:     staffId,
            day_of_week:  s.day_of_week as any,
            is_available: s.is_available,
            start_time:   s.start_time ?? null,
            end_time:     s.end_time   ?? null,
          },
          update: {
            is_available: s.is_available,
            start_time:   s.start_time ?? null,
            end_time:     s.end_time   ?? null,
          },
        })
      )
    );
  }

  static async findLeaves(staffId: string, businessId: string, status?: string) {
    return prisma.staffLeave.findMany({
      where: {
        staff_id: staffId,
        staff:    { business_id: businessId },
        ...(status && { status: status as any }),
      },
      orderBy: { created_at: "desc" },
    });
  }

  static async findAttendance(staffId: string, businessId: string, month: Date) {
    const start = startOfMonth(month);
    const end   = endOfMonth(month);
    return prisma.staffAttendance.findMany({
      where: {
        staff_id:    staffId,
        business_id: businessId,
        date:        { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });
  }
}
