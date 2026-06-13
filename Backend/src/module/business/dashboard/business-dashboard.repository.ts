import { prisma } from "../../../config/prisma";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";

function periodStart(period: "week" | "month" | "year"): Date {
  const now = new Date();
  if (period === "week")  return startOfWeek(now, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(now);
  return startOfYear(now);
}

export class BusinessDashboardRepository {

  // Earnings from Payment table — no wallets
  static async getEarnings(businessId: string) {
    const [settled, pending] = await Promise.all([
      prisma.payment.aggregate({
        where: { business_id: businessId, status: "SETTLED" },
        _sum:  { amount: true },
      }),
      prisma.payment.aggregate({
        where: { business_id: businessId, status: "PAID" },
        _sum:  { amount: true },
      }),
    ]);
    return {
      settled: settled._sum.amount ?? 0,
      pending: pending._sum.amount ?? 0,
    };
  }

  static async getBookingCounts(businessId: string) {
    const today = startOfDay(new Date());

    const [total, completed, cancelled, noShow, todayCount] = await Promise.all([
      prisma.booking.count({ where: { business_id: businessId } }),
      prisma.booking.count({ where: { business_id: businessId, status: "COMPLETED" } }),
      prisma.booking.count({ where: { business_id: businessId, status: "CANCELLED" } }),
      prisma.booking.count({ where: { business_id: businessId, status: "NO_SHOW" } }),
      prisma.booking.count({
        where: { business_id: businessId, service_date: today, status: { not: "PENDING_PAYMENT" } },
      }),
    ]);

    return { total, completed, cancelled: cancelled + noShow, today: todayCount };
  }

  static async getStaffCounts(businessId: string) {
    const [total, active] = await Promise.all([
      prisma.staff.count({ where: { business_id: businessId } }),
      prisma.staff.count({ where: { business_id: businessId, is_active: true } }),
    ]);
    return { total, active };
  }

  static async getPendingLeaveCount(businessId: string) {
    return prisma.staffLeave.count({
      where: { staff: { business_id: businessId }, status: "PENDING" },
    });
  }

  static async getStaffCompletionStats(businessId: string, period: "week" | "month" | "year") {
    const since = periodStart(period);

    const [completed, cancelled] = await Promise.all([
      prisma.booking.groupBy({
        by:    ["staff_id"],
        where: { business_id: businessId, service_date: { gte: since }, status: "COMPLETED" },
        _count: { id: true },
        _sum:   { service_amount: true },
      }),
      prisma.booking.groupBy({
        by:    ["staff_id"],
        where: {
          business_id:  businessId,
          service_date: { gte: since },
          status:       { in: ["CANCELLED", "NO_SHOW"] },
        },
        _count: { id: true },
      }),
    ]);

    return { completed, cancelled };
  }

  static async getStaff(businessId: string) {
    return prisma.staff.findMany({
      where:   { business_id: businessId, is_active: true },
      select: {
        id:             true,
        name:           true,
        avatar_url:     true,
        average_rating: true,
        total_reviews:  true,
      },
      orderBy: { name: "asc" },
    });
  }

  // Monthly earnings from Payment.settled_at
  static async getMonthlyEarnings(businessId: string) {
    const since = subMonths(startOfMonth(new Date()), 11);
    return prisma.payment.findMany({
      where:   { business_id: businessId, status: "SETTLED", settled_at: { gte: since } },
      select:  { amount: true, settled_at: true },
      orderBy: { settled_at: "asc" },
    });
  }

  static async getCompletedBookings(businessId: string, period: "week" | "month" | "year") {
    const since = periodStart(period);
    return prisma.booking.findMany({
      where: { business_id: businessId, status: "COMPLETED", service_date: { gte: since } },
      select: { services: true, service_amount: true },
    });
  }

  static async getBusinessRatings(businessId: string) {
    return prisma.business.findUnique({
      where:  { id: businessId },
      select: { average_rating: true, total_reviews: true },
    });
  }
}
