import { prisma } from "../../../config/prisma";
import {
  startOfWeek,
  startOfMonth,
  startOfYear,
  subMonths,
  startOfDay,
  subDays
} from "date-fns";



function periodStart(period: "week" | "month" | "year"): Date {
  const now = new Date();
  if (period === "week")  return startOfWeek(now, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(now);
  return startOfYear(now);
}

export class OwnerDashboardRepository {

  // Revenue from Payment table — no wallets
  static async getTotalEarningsFromBookings(businessIds: string[]) {
  const result = await prisma.booking.aggregate({
    where: {
      business_id: { in: businessIds },
      is_visible: { not: false },

      // ✅ SAME SOURCE AS YOUR WORKING CARDS
      status: { in: ["COMPLETED", "NO_SHOW"] },

      payment: {
        is: {
          status: { in: ["PAID", "SETTLED"] }
        }
      }
    },
    _sum: { service_amount: true },
  });

  return result._sum.service_amount ?? 0;
}

  static async getBusinesses(businessIds: string[]) {
    return prisma.business.findMany({
  where: { id: { in: businessIds } },
  select: {
    id: true,
    business_name: true,
    logo_url: true, // 🔥 ADD THIS
    is_active: true, 
    images: {
      where: { is_primary: true },
      select: { image_url: true },
      take: 1
    },

    average_rating: true,
    total_reviews: true,

    _count: {
      select: {
        staff: { where: { is_active: true } },
        bookings: true,
      },
    },
  },

  orderBy: { created_at: "asc" },
});
  }

  static async getBookingStats(businessIds: string[]) {
  const now = new Date();

  const baseWhere = {
    business_id: { in: businessIds },
    is_visible: { not: false },
    status: { notIn: ["PENDING_PAYMENT", "EXPIRED"] as any },
    payment: {
      is: {
        status: { in: ["PAID", "SETTLED", "REFUNDED"] as any }
      }
    }
  };

  const [
    total,
    completed,
    refunded,
    noShow,
    upcoming,
    today
  ] = await Promise.all([

    // ✅ TOTAL (real bookings only)
    prisma.booking.count({
      where: {
        ...baseWhere,
        OR: [
          { status: { not: "CONFIRMED" } },
          { service_date: { gte: startOfDay(now) } }
        ]
      }
    }),

    // ✅ COMPLETED
    prisma.booking.count({
      where: { ...baseWhere, status: "COMPLETED" }
    }),

    // ✅ REFUNDED
    prisma.booking.count({
      where: { ...baseWhere, status: "REFUNDED" }
    }),

    // ✅ NO SHOW
    prisma.booking.count({
      where: { ...baseWhere, status: "NO_SHOW" }
    }),

    // ✅ UPCOMING
    prisma.booking.count({
      where: {
        ...baseWhere,
        status: "CONFIRMED",
        service_date: { gt: startOfDay(now) }
      }
    }),

    // ✅ TODAY BOOKINGS
    prisma.booking.count({
      where: {
        ...baseWhere,
        service_date: {
          gte: startOfDay(now),
          lt: new Date(startOfDay(now).getTime() + 86400000)
        },
        status: { in: ["CONFIRMED", "RUNNING"] }
      }
    }),

  ]);

  return { total, completed, refunded, noShow, upcoming, today };
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

  // Monthly earnings from Payment.settled_at
  static async getMonthlyEarnings(businessIds: string[], year: number) {
  const start = new Date(year, 0, 1)
  const end   = new Date(year + 1, 0, 1)

  return prisma.payment.findMany({
    where: {
      business_id: { in: businessIds },
      status: { in: ["PAID", "SETTLED"] },
      settled_at: {
        gte: start,
        lt: end,
      },
    },
    select: { amount: true, settled_at: true, booking_id: true },
    orderBy: { settled_at: "asc" },
  });
}

  static async getBestStaff(businessIds: string[]) {
  

    const groups = await prisma.booking.groupBy({
      by:      ["staff_id"],
      where: {
  business_id: { in: businessIds },
  is_visible: { not: false },
  status: "COMPLETED",
  payment: {
  is: {
    status: { in: ["PAID", "SETTLED", "REFUNDED"] }
  }
}
},
      _count:  { id: true },
      _sum:    { service_amount: true },
      orderBy: { _count: { id: "desc" } },
      take:    1,
    });

    if (!groups.length) return null;

    const top = groups[0];
    return prisma.staff.findUnique({
      where:   { id: top.staff_id },
      include: { business: { select: { business_name: true } } },
    }).then(staff => staff ? {
      staff,
      period_bookings: top._count.id,
      period_earning:  top._sum.service_amount ?? 0,
    } : null);
  }

  static async getCompletedBookingsForPeriod(
  businessIds: string[],
  year: number
) {
  const start = new Date(year, 0, 1)
const end   = new Date(year + 1, 0, 1)
  return prisma.booking.findMany({
  where: {
    business_id: { in: businessIds },
    status: "COMPLETED",
    service_date: {
      gte: start,
      lt: end,
    },
    payment: {
  is: {
    status: { in: ["PAID", "SETTLED"] },
  },
},
  },
  select: {
    id: true,
    service_amount: true,
    services: true,
  },
});
}

  // Per-business earnings for business cards
  static async getEarningsPerBusiness(businessIds: string[]) {
    const groups = await prisma.payment.groupBy({
      by:    ["business_id"],
      where: { business_id: { in: businessIds },  },
      _sum:  { amount: true },
    });
    return new Map(groups.map(g => [g.business_id, g._sum.amount ?? 0]));
  }

  static async getPendingPerBusiness(businessIds: string[]) {
    const groups = await prisma.payment.groupBy({
      by:    ["business_id"],
      where: { business_id: { in: businessIds }, status: "PAID" },
      _sum:  { amount: true },
    });
    return new Map(groups.map(g => [g.business_id, g._sum.amount ?? 0]));
  }

  // 🔥 BUSINESS-WISE EARNINGS (FOR BAR CHART)
static async getBusinessWiseEarnings(businessIds: string[]) {
  return prisma.booking.groupBy({
    by: ["business_id"],
    where: {
      business_id: { in: businessIds },
      is_visible: { not: false },

      // ✅ SAME LOGIC AS YOUR WORKING BUSINESS CARD
      status: { in: ["COMPLETED", "NO_SHOW"] },

      payment: {
        is: {
          status: { in: ["PAID", "SETTLED"] },
        },
      },
    },
    _sum: {
      service_amount: true,
    },
  });
}

// 🔥 STAFF PERFORMANCE (EARNING + BOOKINGS)
static async getStaffPerformance(businessIds: string[], year: number) {
  const start = new Date(year, 0, 1)
  const end   = new Date(year + 1, 0, 1)

  const result = await prisma.booking.groupBy({
    by: ["staff_id"],
    where: {
      business_id: { in: businessIds },
      status: "COMPLETED",
      is_visible: { not: false },
      service_date: {
        gte: start,
        lt: end,
      },
      payment: {
        is: {
          status: { in: ["PAID", "SETTLED"] }
        }
      }
    },
    _count: { id: true },
    _sum: { service_amount: true },
  });

  const staff = await prisma.staff.findMany({
    where: { id: { in: result.map(r => r.staff_id) } },
    select: {
      id: true,
      name: true,
      avatar_url: true,
    },
  });

  return result.map(r => {
    const s = staff.find(st => st.id === r.staff_id);
    return {
      staff_id: r.staff_id,
      staff_name: s?.name ?? "Unknown",
      avatar: s?.avatar_url ?? null,
      bookings: r._count.id,
      earning_inr: (r._sum.service_amount ?? 0) / 100,
    };
  });
}

// 🔥 DAILY BOOKINGS (LAST 7 DAYS)
static async getDailyBookings(businessIds: string[]) {
  const since = new Date();
  since.setDate(since.getDate() - 6);

  const bookings = await prisma.booking.findMany({
    where: {
      business_id: { in: businessIds },
      status: "COMPLETED",
      service_date: { gte: since },
      is_visible: { not: false },
    },
    select: { service_date: true },
  });

  return bookings;
}

static async getNoShowEarnings(businessIds: string[]) {
  const result = await prisma.booking.aggregate({
    where: {
      business_id: { in: businessIds },
      status: "NO_SHOW",
      is_visible: { not: false },
      payment: {
        is: {
          status: { in: ["PAID", "SETTLED"] }
        }
      }
    },
    _sum: { service_amount: true },
  });

  return result._sum.service_amount ?? 0;
}

static async getCompletedEarnings(businessIds: string[]) {
  const result = await prisma.booking.aggregate({
    where: {
      business_id: { in: businessIds },
      status: "COMPLETED",
      payment: {
  is: { status: { in: ["PAID", "SETTLED"] } }
}
    },
    _sum: { service_amount: true }
  });

  return result._sum.service_amount ?? 0;
}

static async getUpcomingEarnings(businessIds: string[]) {
  const result = await prisma.booking.aggregate({
    where: {
      business_id: { in: businessIds },
      status: "CONFIRMED",
      service_date: { gt: new Date() },
      payment: {
        is: { status: "PAID" }
      }
    },
    _sum: { service_amount: true }
  });

  return result._sum.service_amount ?? 0;
}

static async getMonthlyCompletedBookings(businessIds: string[], year: number) {
  const start = new Date(year, 0, 1)
  const end   = new Date(year + 1, 0, 1)

  return prisma.booking.findMany({
    where: {
      business_id: { in: businessIds },
      status: "COMPLETED",
      service_date: {
        gte: start,
        lt: end,
      },
      is_visible: { not: false },
    },
    select: { service_date: true },
  });
}


}