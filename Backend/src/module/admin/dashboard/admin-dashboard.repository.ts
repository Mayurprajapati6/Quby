import { prisma } from "../../../config/prisma";
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  subMonths,
} from "date-fns";

export class AdminDashboardRepository {

  static async getUserCounts(since: Date) {
    const now = new Date();
    return Promise.all([
      prisma.customer.count(),
      prisma.owner.count(),
      prisma.staff.count({ where: { is_active: true } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { created_at: { gte: since, lte: now } } }),
    ]);
  }

  static async getBusinessStats(periodStart: Date, periodEnd: Date) {
    return Promise.all([
      prisma.business.findMany({ select: { is_active: true } }),
      prisma.business.count({ where: { created_at: { gte: periodStart, lte: periodEnd } } }),
    ]);
  }

  static async getTodayActivity() {
    const now = new Date();
    return prisma.booking.findMany({
      where: {
        service_date: startOfDay(now),
        status:       { not: "PENDING_PAYMENT" },
      },
      select: { status: true, service_amount: true },
    });
  }

  // Revenue from Payment table (not platform_fee_transactions)
  static async getPaymentRevenue(periodStart: Date, periodEnd: Date) {
    const now        = new Date();
    const todayStart = startOfDay(now);
    const todayEnd   = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd   = endOfMonth(now);

    return Promise.all([
      // Today's settled
      prisma.payment.aggregate({
        where: { status: "SETTLED", settled_at: { gte: todayStart, lte: todayEnd } },
        _sum:  { amount: true },
      }),
      // Period settled
      prisma.payment.aggregate({
        where: { status: "SETTLED", settled_at: { gte: periodStart, lte: periodEnd } },
        _sum:  { amount: true },
      }),
      // All-time settled
      prisma.payment.aggregate({
        where: { status: "SETTLED" },
        _sum:  { amount: true },
      }),
      // This month refunded
      prisma.payment.aggregate({
        where: { status: "REFUNDED", refunded_at: { gte: monthStart, lte: monthEnd } },
        _sum:  { refund_amount: true },
      }),
      // This month settled
      prisma.payment.aggregate({
        where: { status: "SETTLED", settled_at: { gte: monthStart, lte: monthEnd } },
        _sum:  { amount: true },
      }),
    ]);
  }

  static async getMonthlyRevenue() {
    const since = subMonths(startOfMonth(new Date()), 11);
    return prisma.payment.findMany({
      where:   { status: "SETTLED", settled_at: { gte: since } },
      select:  { settled_at: true, amount: true },
    });
  }

  static async getTopBusinesses() {
  const rows = await prisma.booking.groupBy({
  by: ["business_id"],

  where: {
    status: {
      in: ["COMPLETED", "NO_SHOW"], // ✅ YOUR TRUE BUSINESS LOGIC
    },
  },

  _sum: {
    service_amount: true, // ✅ THIS IS YOUR REAL MONEY
  },

  _count: {
    id: true,
  },

  orderBy: {
    _sum: {
      service_amount: "desc",
    },
  },

  take: 5,
});

  if (!rows.length) return [];

  const ids = rows.map(r => r.business_id);

  const details = await prisma.business.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      business_name: true,
      city: true,
      state: true,
      average_rating: true,
      logo_url: true, // ✅ ADD THIS
    },
  });

  const map = new Map(details.map(d => [d.id, d]));

  

  return rows.map(r => ({
    business_id: r.business_id,
    business_name: map.get(r.business_id)?.business_name ?? "—",
    city: map.get(r.business_id)?.city ?? "—",
    state: map.get(r.business_id)?.state ?? "—",
    average_rating: map.get(r.business_id)?.average_rating ?? 0,
    logo_url: map.get(r.business_id)?.logo_url ?? null,

    booking_count: r._count.id,
    revenue_inr: (r._sum.service_amount  ?? 0) / 100, // ✅ CORRECT
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

    // ✅ TOTAL = ONLY VALID BOOKINGS
    prisma.booking.count({
      where: {
        service_date: { gte: periodStart, lte: periodEnd },
        status: {
          in: ["COMPLETED", "NO_SHOW"] // ✅ FIXED
        },
      },
    }),

    prisma.booking.count({
      where: {
        service_date: { gte: periodStart, lte: periodEnd },
        status: "COMPLETED",
      },
    }),

    prisma.booking.count({
      where: {
        service_date: { gte: periodStart, lte: periodEnd },
        status: "NO_SHOW", // ✅ CHANGE FROM CANCELLED
      },
    }),
  ]);
}

static async getRefundedBookings(periodStart: Date, periodEnd: Date) {
  const rows = await prisma.payment.findMany({
    where: {
      refund_status: "DONE", // ✅ TRUST THIS ONLY
    },
    select: {
      booking_id: true,
    },
    distinct: ["booking_id"],
  });

  return rows.length;
}
}
