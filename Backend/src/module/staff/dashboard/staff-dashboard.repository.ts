import { prisma } from "../../../config/prisma";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, subMonths } from "date-fns";

function periodStart(period: "week" | "month" | "year"): Date {
  const now = new Date();
  if (period === "week")  return startOfWeek(now, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(now);
  return startOfYear(now);
}

export class StaffDashboardRepository {

  static async findStaff(userId: string) {
    return prisma.staff.findUnique({
      where:   { user_id: userId },
      include: { business: { select: { id: true, business_name: true } } },
    });
  }

  static async findTodayBookings(staffId: string) {
    const now = new Date();
    return prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: startOfDay(now),
        status:       { not: "PENDING_PAYMENT" },
      },
      include: {
        customer: { select: { name: true, avatar_url: true } },
      },
      orderBy: { queue_number: "asc" },
    });
  }

  static async getBookingCounts(staffId: string, period: "week" | "month" | "year") {
    const since = periodStart(period);

    const [total, completed, cancelled] = await Promise.all([
      prisma.booking.count({
        where: { staff_id: staffId, service_date: { gte: since }, status: { not: "PENDING_PAYMENT" } },
      }),
      prisma.booking.count({
        where: { staff_id: staffId, service_date: { gte: since }, status: "COMPLETED" },
      }),
      prisma.booking.count({
        where: {
          staff_id:     staffId,
          service_date: { gte: since },
          status:       { in: ["CANCELLED", "CANCELLED_TIMEOUT", "CANCELLED_NO_SHOW"] },
        },
      }),
    ]);

    return { total, completed, cancelled };
  }

  static async getDurationAggregation(staffId: string, period: "week" | "month" | "year") {
    const since = periodStart(period);

    const result = await prisma.booking.aggregate({
      where: {
        staff_id:        staffId,
        status:          "COMPLETED",
        service_date:    { gte: since },
        staff_taken_time: { not: null },
      },
      _avg:   { estimated_duration: true, staff_taken_time: true },
      _count: { id: true },
    });

    const avgExpected = result._avg.estimated_duration ?? 0;
    const avgActual   = result._avg.staff_taken_time   ?? 0;

    return {
      total_completed:           result._count.id,
      avg_expected_duration_min: Math.round(avgExpected),
      avg_staff_taken_time_min:  Math.round(avgActual),
      performance_diff_min:      Math.round(avgActual - avgExpected),
      efficiency_pct:            avgExpected > 0
        ? Math.min(100, Math.round((avgExpected / avgActual) * 100))
        : 100,
    };
  }

  static async getPeriodRevenue(staffId: string, period: "week" | "month" | "year") {
    const since = periodStart(period);
    const result = await prisma.booking.aggregate({
      where: { staff_id: staffId, service_date: { gte: since }, status: "COMPLETED" },
      _sum:  { total_amount: true },
    });
    return result._sum.total_amount ?? 0;
  }

  static async getMonthPerformance(staffId: string) {
    return prisma.staffPerformance.findUnique({
      where: { staff_id_month: { staff_id: staffId, month: startOfMonth(new Date()) } },
    });
  }

  static async getMonthlyRevenue(staffId: string) {
    const since = subMonths(startOfMonth(new Date()), 11);

    return prisma.booking.findMany({
      where: { staff_id: staffId, status: "COMPLETED", service_date: { gte: since } },
      select: { service_date: true, total_amount: true },
    });
  }

  static async getCompletedBookings(staffId: string, period: "week" | "month" | "year") {
    const since = periodStart(period);
    return prisma.booking.findMany({
      where:  { staff_id: staffId, status: "COMPLETED", service_date: { gte: since } },
      select: { services: true, total_amount: true },
    });
  }

  static async getPendingCounts(staffId: string) {
    const [leaves, notifications] = await Promise.all([
      prisma.staffLeave.count({ where: { staff_id: staffId, status: "PENDING" } }),
      prisma.staffNotification.count({ where: { staff_id: staffId, is_read: false } }),
    ]);
    return { leaves, notifications };
  }
}
