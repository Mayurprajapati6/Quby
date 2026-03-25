import { prisma } from "../../../config/prisma";
import {
  startOfWeek,
  startOfMonth,
  startOfYear,
  subMonths,
  startOfDay,
} from "date-fns";

const IST = "Asia/Kolkata";

function periodStart(period: "week" | "month" | "year"): Date {
  const now = new Date();
  if (period === "week")  return startOfWeek(now, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(now);
  return startOfYear(now);
}

export class OwnerDashboardRepository {

  static async getWallets(businessIds: string[]) {
    return prisma.businessWallet.findMany({
      where:  { business_id: { in: businessIds } },
      select: {
        business_id:       true,
        balance:           true,
        lifetime_earnings: true,
      },
    });
  }

  static async getBusinesses(businessIds: string[]) {
    const today = startOfDay(new Date());

    return prisma.business.findMany({
      where:   { id: { in: businessIds } },
      include: {
        wallet: { select: { balance: true, lifetime_earnings: true } },
        images: { where: { is_primary: true }, select: { image_url: true }, take: 1 },
        _count: {
          select: {
            staff:    { where: { is_active: true } },
            bookings: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    });
  }

  static async getBookingCounts(businessIds: string[]) {
    const today = startOfDay(new Date());

    const [allTime, completed, cancelled, todayBookings] = await Promise.all([
      prisma.booking.groupBy({
        by:     ["business_id"],
        where:  { business_id: { in: businessIds }, status: "COMPLETED" },
        _count: { id: true },
      }),
      prisma.booking.groupBy({
        by:     ["business_id"],
        where:  {
          business_id: { in: businessIds },
          status:      { in: ["CANCELLED", "CANCELLED_TIMEOUT", "CANCELLED_NO_SHOW"] },
        },
        _count: { id: true },
      }),
      prisma.booking.groupBy({
        by:     ["business_id"],
        where:  { business_id: { in: businessIds }, service_date: today },
        _count: { id: true },
      }),
      Promise.resolve([]),
    ]);

    return { completed: allTime, cancelled, today: todayBookings };
  }

  static async getTotalBookingStats(businessIds: string[]) {
    const [total, completed, cancelled] = await Promise.all([
      prisma.booking.count({ where: { business_id: { in: businessIds } } }),
      prisma.booking.count({
        where: { business_id: { in: businessIds }, status: "COMPLETED" },
      }),
      prisma.booking.count({
        where: {
          business_id: { in: businessIds },
          status:      { in: ["CANCELLED", "CANCELLED_TIMEOUT", "CANCELLED_NO_SHOW"] },
        },
      }),
    ]);
    return { total, completed, cancelled };
  }

  static async getStaffCounts(businessIds: string[]) {
    const [total, active] = await Promise.all([
      prisma.staff.count({ where: { business_id: { in: businessIds } } }),
      prisma.staff.count({ where: { business_id: { in: businessIds }, is_active: true } }),
    ]);
    return { total, active };
  }

  static async getPendingLeaveCount(businessIds: string[]) {
    return prisma.staffLeave.count({
      where: { staff: { business_id: { in: businessIds } }, status: "PENDING" },
    });
  }

  static async getMonthlyEarnings(businessIds: string[]) {
    const since = subMonths(startOfMonth(new Date()), 11);

    return prisma.businessWalletTransaction.findMany({
      where: {
        wallet:     { business_id: { in: businessIds } },
        type:       "ESCROW_RELEASE",
        created_at: { gte: since },
      },
      select: {
        amount:     true,
        created_at: true,
        booking_id: true,
      },
      orderBy: { created_at: "asc" },
    });
  }

  static async getBestStaff(businessIds: string[], period: "week" | "month" | "year") {
    const since = periodStart(period);

    const groups = await prisma.booking.groupBy({
      by:     ["staff_id"],
      where:  {
        business_id: { in: businessIds },
        status:      "COMPLETED",
        service_date: { gte: since },
      },
      _count: { id: true },
      _sum:   { total_amount: true },
      orderBy: { _count: { id: "desc" } },
      take:    1,
    });

    if (!groups.length) return null;

    const top = groups[0];
    return prisma.staff.findUnique({
      where:   { id: top.staff_id },
      include: { business: { select: { business_name: true } } },
    }).then(staff => staff
      ? {
          staff,
          period_bookings:   top._count.id,
          period_earning:    top._sum.total_amount ?? 0,
        }
      : null
    );
  }

  static async getCompletedBookingsForPeriod(
    businessIds: string[],
    period: "week" | "month" | "year",
  ) {
    const since = periodStart(period);

    return prisma.booking.findMany({
      where: {
        business_id:  { in: businessIds },
        status:       "COMPLETED",
        service_date: { gte: since },
      },
      select: {
        services:     true,   
        total_amount: true,
        service_amount: true,
      },
    });
  }

  static async getBestBusiness(businessIds: string[]) {
    const wallet = await prisma.businessWallet.findFirst({
      where:   { business_id: { in: businessIds } },
      include: {
        business: {
          include: {
            images: { where: { is_primary: true }, select: { image_url: true }, take: 1 },
          },
        },
      },
      orderBy: { lifetime_earnings: "desc" },
    });
    return wallet;
  }
}
