import { prisma } from "../../../config/prisma";
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  subMonths,
} from "date-fns";

function periodBounds(period: "week" | "month" | "year") {
  const now = new Date();
  if (period === "week")  return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now,   { weekStartsOn: 1 }) };
  if (period === "month") return { start: startOfMonth(now),                      end: endOfMonth(now) };
  return                         { start: startOfYear(now),                       end: endOfYear(now)  };
}

export class AdminDashboardRepository {

  static async getUserCounts(since: Date) {
    const now = new Date();
    return Promise.all([
      prisma.customer.count(),
      prisma.owner.count(),
      prisma.staff.count({ where: { is_active: true } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { created_at: { gte: since, lte: now } } }),
      prisma.user.count({ where: { is_suspended: true } }),
    ]);
  }

  static async getBusinessStats(periodStart: Date, periodEnd: Date) {
    return Promise.all([
      prisma.business.findMany({
        select: { is_verified: true, is_active: true },
      }),
      prisma.business.count({
        where: { created_at: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.business.count({ where: { is_verified: false, is_active: true } }),
    ]);
  }

  static async getTodayActivity() {
    const now = new Date();
    return prisma.booking.findMany({
      where: {
        service_date: startOfDay(now),
        status:       { not: "PENDING_PAYMENT" },
      },
      select: { status: true, platform_fee: true, service_amount: true },
    });
  }

  static async getPlatformRevenue(periodStart: Date, periodEnd: Date) {
    const now        = new Date();
    const todayStart = startOfDay(now);
    const todayEnd   = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd   = endOfMonth(now);

    return Promise.all([
      prisma.platformFeeTransaction.aggregate({
        where: { collected_at: { gte: todayStart, lte: todayEnd } },
        _sum:  { amount: true },
      }),
      prisma.platformFeeTransaction.aggregate({
        where: { collected_at: { gte: periodStart, lte: periodEnd } },
        _sum:  { amount: true },
      }),
      prisma.platformFeeTransaction.aggregate({
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { status: "REFUNDED", refunded_at: { gte: monthStart, lte: monthEnd } },
        _sum:  { refund_amount: true },
      }),
      prisma.platformFeeTransaction.aggregate({
        where: { collected_at: { gte: monthStart, lte: monthEnd } },
        _sum:  { amount: true },
      }),
    ]);
  }

  static async getMonthlyRevenue() {
    const since = subMonths(startOfMonth(new Date()), 11);
    return prisma.platformFeeTransaction.findMany({
      where:  { collected_at: { gte: since } },
      select: { collected_at: true, amount: true },
    });
  }

  static async getTopBusinesses(monthStart: Date, monthEnd: Date) {
    const rows = await prisma.platformFeeTransaction.groupBy({
      by:      ["business_id"],
      where:   { collected_at: { gte: monthStart, lte: monthEnd } },
      _sum:    { amount: true },
      _count:  { id: true },
      orderBy: { _sum: { amount: "desc" } },
      take:    5,
    });

    if (!rows.length) return [];

    const ids      = rows.map(r => r.business_id);
    const details  = await prisma.business.findMany({
      where:  { id: { in: ids } },
      select: { id: true, business_name: true, city: true, state: true, average_rating: true },
    });
    const detailMap = new Map(details.map(d => [d.id, d]));

    return rows.map(r => ({
      business_id:    r.business_id,
      business_name:  detailMap.get(r.business_id)?.business_name  ?? "—",
      city:           detailMap.get(r.business_id)?.city            ?? "—",
      state:          detailMap.get(r.business_id)?.state           ?? "—",
      average_rating: detailMap.get(r.business_id)?.average_rating  ?? 0,
      booking_count:  r._count.id,
      platform_fee_inr: (r._sum.amount ?? 0) / 100,
    }));
  }

  static async getTopCities(monthStart: Date, monthEnd: Date) {
    const rows = await prisma.booking.groupBy({
      by:      ["business_id"],
      where:   { service_date: { gte: monthStart, lte: monthEnd }, status: "COMPLETED" },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    30,
    });

    if (!rows.length) return [];

    const ids     = rows.map(r => r.business_id);
    const details = await prisma.business.findMany({
      where:  { id: { in: ids } },
      select: { id: true, city: true, state: true },
    });
    const detailMap = new Map(details.map(d => [d.id, d]));

    const cityMap = new Map<string, { state: string; bookings: number; bizIds: Set<string> }>();
    for (const r of rows) {
      const biz = detailMap.get(r.business_id);
      if (!biz) continue;
      const entry = cityMap.get(biz.city) ?? { state: biz.state, bookings: 0, bizIds: new Set() };
      entry.bookings += r._count.id;
      entry.bizIds.add(r.business_id);
      cityMap.set(biz.city, entry);
    }

    return Array.from(cityMap.entries())
      .sort((a, b) => b[1].bookings - a[1].bookings)
      .slice(0, 5)
      .map(([city, d]) => ({
        city,
        state:          d.state,
        total_bookings: d.bookings,
        business_count: d.bizIds.size,
      }));
  }
  
  static async getBookingCounts(periodStart: Date, periodEnd: Date) {
    return Promise.all([
      prisma.booking.count({
        where: { service_date: { gte: periodStart, lte: periodEnd }, status: { not: "PENDING_PAYMENT" } },
      }),
      prisma.booking.count({
        where: { service_date: { gte: periodStart, lte: periodEnd }, status: "COMPLETED" },
      }),
      prisma.booking.count({
        where: { service_date: { gte: periodStart, lte: periodEnd }, status: { in: ["CANCELLED", "CANCELLED_TIMEOUT", "CANCELLED_NO_SHOW"] } },
      }),
    ]);
  }
}
