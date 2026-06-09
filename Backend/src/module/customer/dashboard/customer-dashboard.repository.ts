import { prisma } from "../../../config/prisma";
import { endOfMonth, startOfDay, sub } from "date-fns";

export class CustomerDashboardRepository {

  static async findCustomerWithWallet(userId: string) {
    return prisma.customer.findUnique({
      where:   { user_id: userId },
      include: {
        
      },
    });
  }

  static async countPendingReviews(customerId: string): Promise<number> {
    const windowStart = sub(new Date(), { days: 14 });
    return prisma.booking.count({
      where: {
        customer_id:  customerId,
        status:       "COMPLETED",
        service_date: { gte: windowStart },
        review:       null,
      },
    });
  }

  static async findNextUpcomingBooking(customerId: string) {
    return prisma.booking.findFirst({
      where: {
        customer_id:  customerId,
        status:       { in: ["CONFIRMED"] },
        service_date: { gte: startOfDay(new Date()) },
      },
      orderBy: [{ service_date: "asc" }, { service_start_time: "asc" }],
      include: {
        business: { select: { business_name: true, logo_url: true } },
        staff:    { select: { name: true, avatar_url: true } },
        qr_code:  { select: { qr_image_url: true } },
      },
    });
  }

  static async findRecentBookings(customerId: string, take = 5) {
    return prisma.booking.findMany({
      where: {
        customer_id: customerId,
        status:      { notIn: ["PENDING_PAYMENT"] },
      },
      orderBy: { service_date: "desc" },
      take,
      include: {
        business: { select: { business_name: true, logo_url: true } },
        review:   { select: { id: true } },
      },
    });
  }

  static async findPendingReviews(customerId: string) {
    const windowStart = sub(new Date(), { days: 14 });
    return prisma.booking.findMany({
  where: {
    customer_id:  customerId,
    status:       "COMPLETED",
    service_date: { gte: windowStart },
    review:       null,
  },
  orderBy: { service_date: "desc" },

  select: {
    id: true,
    booking_number: true,
    service_date: true,
    services: true,

    business: {
      select: { id: true, business_name: true },
    },
    staff: {
      select: { id: true, name: true },
    },
  },
});
  }

  static async findMostBookedSalon(customerId: string) {
    const result = await prisma.booking.groupBy({
      by:      ["business_id"],
      where:   { customer_id: customerId, status: "COMPLETED" },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    1,
    });
    if (!result.length) return null;

    const biz = await prisma.business.findUnique({
      where:  { id: result[0].business_id },
      select: { id: true, business_name: true, logo_url: true },
    });
    return biz ? { id: biz.id, name: biz.business_name, logo: biz.logo_url, count: result[0]._count.id } : null;
  }

  static async findMostBookedStaff(customerId: string) {
    const result = await prisma.booking.groupBy({
      by:      ["staff_id"],
      where:   { customer_id: customerId, status: "COMPLETED" },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    1,
    });
    if (!result.length) return null;

    const staff = await prisma.staff.findUnique({
      where:  { id: result[0].staff_id },
      select: { id: true, name: true, avatar_url: true },
    });
    return staff ? { id: staff.id, name: staff.name, logo: staff.avatar_url, count: result[0]._count.id } : null;
  }

  static async findMostBookedService(customerId: string) {
    
    const bookings = await prisma.booking.findMany({
      where:  { customer_id: customerId, status: "COMPLETED" },
      select: { services: true },
    });

    const countMap = new Map<string, number>();
    for (const b of bookings) {
      const svcs = Array.isArray(b.services) ? (b.services as any[]) : [];
      for (const s of svcs) {
        if (s.name) countMap.set(s.name, (countMap.get(s.name) ?? 0) + 1);
      }
    }
    if (countMap.size === 0) return null;

    const [topName, topCount] = [...countMap.entries()].sort((a, b) => b[1] - a[1])[0];
    return { id: null, name: topName, logo: null, count: topCount };
  }

  static async getMonthlySpend(
    customerId: string,
    year?:      number,
  ): Promise<{ year: number; month: number; amount: number; count: number }[]> {

    const now        = new Date();
    const filterYear = year ?? now.getFullYear();

    const bookings = await prisma.booking.findMany({
      where: {
        customer_id:  customerId,
        status: { in: ["COMPLETED", "NO_SHOW"] },
        service_date: {
          gte: new Date(`${filterYear}-01-01T00:00:00+05:30`),
          lte: new Date(`${filterYear}-12-31T23:59:59+05:30`),
        },
      },
      select: { service_date: true, service_amount: true },
    });

    const grouped: Record<number, { amount: number; count: number }> = {};
    for (let m = 1; m <= 12; m++) grouped[m] = { amount: 0, count: 0 };

    for (const b of bookings) {
      const month = b.service_date.getMonth() + 1; 
      grouped[month].amount += (b as any).service_amount ?? 0;
      grouped[month].count  += 1;
    }

    return Object.entries(grouped).map(([month, data]) => ({
      year:   filterYear,
      month:  parseInt(month),
      amount: data.amount,
      count:  data.count,
    }));
  }

  static async getCalendarEvents(
    customerId: string,
    month:      number,
    year:       number,
  ) {
   const monthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`)
const monthEnd   = new Date(monthStart)
monthEnd.setMonth(monthEnd.getMonth() + 1)
monthEnd.setMilliseconds(-1)

    const data = await prisma.booking.findMany({
  where: {
    customer_id: customerId,

    service_date: {
      gte: monthStart,
      lte: monthEnd,
    },

    is_visible: { not: false },

    status: {
      notIn: ["PENDING_PAYMENT", "EXPIRED"]
    },
  },

  include: {
    business: {
      select: {
        business_name: true,
        logo_url: true,
        city: true,
        state: true,
      }
    },
    staff: {
      select: {
        name: true,
        avatar_url: true,
      }
    },
    payment: {
      select: {
        refund_amount: true,
      }
    }
  },

  orderBy: [{ service_date: "asc" }, { service_start_time: "asc" }],
})

console.log("📅 FILTER RANGE 👉", monthStart, monthEnd)

console.log(
  "📅 DB RESULT 👉",
  data.map(b => ({
    id: b.id,
    date: b.service_date,
    status: b.status
  }))
)

return data
  }

   static async getBookingStats(customerId: string) {
  const [total, completed, cancelled, no_show, upcoming] = await Promise.all([

    // ✅ TOTAL = ONLY PAID BOOKINGS
    // ✅ TOTAL (FIXED)
    prisma.booking.count({
  where: {
    customer_id: customerId,

    is_visible: { not: false },
    status: { notIn: ["PENDING_PAYMENT", "EXPIRED"] },

    payment: {
      is: {
        status: { in: ["PAID", "SETTLED", "REFUNDED"] }
      }
    },

    OR: [
      { status: { not: "CONFIRMED" } },
      { service_date: { gte: startOfDay(new Date()) } } // 🔥 FIX
    ]
  },
}),

    // ✅ COMPLETED
    prisma.booking.count({
      where: {
        customer_id: customerId,
        status: "COMPLETED",
        payment: {
          is: {
            status: { in: ["PAID", "SETTLED"] }
          }
        }
      },
    }),

    // ✅ CANCELLED (ALL TYPES)
    prisma.booking.count({
      where: {
        customer_id: customerId,
        status: {
          in: ["CANCELLED", "REFUND_INITIATED", "REFUNDED"]
        },
      },
    }),

    // ✅ NO SHOW
    prisma.booking.count({
      where: {
        customer_id: customerId,
        status: "NO_SHOW",
        payment: {
          is: {
            status: { in: ["PAID", "SETTLED"] }
          }
        }
      },
    }),

    // ✅ UPCOMING
    prisma.booking.count({
  where: {
    customer_id: customerId,
    status: { in: ["CONFIRMED", "RUNNING"] },
    service_date: { gte: startOfDay(new Date()) } // 🔥 FIX
  },
}),
  ]);
  

  return { total, completed, cancelled, no_show, upcoming };
}

  static async getSpendStats(customerId: string) {
  const bookings = await prisma.booking.findMany({
    where: {
      customer_id: customerId,
      status: { in: ["COMPLETED", "NO_SHOW", "REFUNDED"] },
    },
    include: {
      payment: true,
    },
  });

  let totalSpent = 0;
let refunded = 0;

for (const b of bookings) {
  const amount = (b as any).service_amount ?? 0;
  const refundAmount = b.payment?.refund_amount ?? 0;

  // ✅ Money you actually paid (COMPLETED + NO_SHOW)
  if (b.status === "COMPLETED" || b.status === "NO_SHOW") {
    totalSpent += amount;
  }

  // ✅ Actual refunded money (from payment table)
  if (refundAmount > 0) {
    refunded += refundAmount;
  }
}

return {
  total_spent: totalSpent,        // ✅ NO subtraction
  refunded_amount: refunded,      // ✅ separate
};
}

static async getBookingFrequency(customerId: string, year: number) {
  const bookings = await prisma.booking.findMany({
    where: {
      customer_id: customerId,
      status: { notIn: ["PENDING_PAYMENT"] },
      service_date: {
        gte: new Date(`${year}-01-01T00:00:00+05:30`),
        lte: new Date(`${year}-12-31T23:59:59+05:30`),
      },
    },
    select: { service_date: true },
  });

  const map: Record<number, number> = {};
  for (let i = 1; i <= 12; i++) map[i] = 0;

  bookings.forEach(b => {
    const m = b.service_date.getMonth() + 1;
    map[m]++;
  });

  return Object.entries(map).map(([month, count]) => ({
    month: Number(month),
    count,
  }));
}

static async getBookingBreakdown(customerId: string) {
  const [completed, cancelled, no_show, upcoming] = await Promise.all([
    prisma.booking.count({ where: { customer_id: customerId, status: "COMPLETED" } }),
    prisma.booking.count({ where: { customer_id: customerId, status: "CANCELLED" } }),
    prisma.booking.count({ where: { customer_id: customerId, status: "NO_SHOW" } }),
    prisma.booking.count({
      where: { customer_id: customerId, status: { in: ["CONFIRMED", "RUNNING"] } },
    }),
  ]);

  return { completed, cancelled, no_show, upcoming };
}

static async getServiceUsage(customerId: string) {
  const bookings = await prisma.booking.findMany({
    where: {
      customer_id: customerId,
      status: { in: ["COMPLETED", "NO_SHOW"] },
    },
    select: { services: true },
  });

  const map = new Map<
    string,
    { count: number; image: string | null; revenue: number }
  >();

  bookings.forEach(b => {
    const svcs = Array.isArray(b.services) ? b.services : [];

    svcs.forEach((s: any) => {
      if (!s.name) return;

      const prev = map.get(s.name) ?? {
        count: 0,
        image: s.image_url ?? null,
        revenue: 0,
      };

      map.set(s.name, {
        count: prev.count + 1,
        image: prev.image,
        revenue: prev.revenue + (s.price ?? 0), // ✅ IMPORTANT
      });
    });
  });

  return [...map.entries()]
  .map(([name, val]) => ({
    name,
    count: val.count,
    image: val.image,
    revenue: val.revenue,
  }))
  .sort((a, b) => b.count - a.count).slice(0, 5); // 🔥 SORT DESC
}

static async getBusinessFrequency(customerId: string) {
  const result = await prisma.booking.groupBy({
    by: ["business_id"],
    where: {
      customer_id: customerId,
      status: { in: ["COMPLETED", "NO_SHOW"] },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const businesses = await prisma.business.findMany({
    where: { id: { in: result.map(r => r.business_id) } },
    select: { id: true, business_name: true, logo_url: true },
  });

  return result.map(r => {
    const biz = businesses.find(b => b.id === r.business_id)
    return {
      name: biz?.business_name ?? "Unknown",
      logo: biz?.logo_url ?? null,
      count: r._count.id,
    }
  })
}

static async getRefundCount(customerId: string) {
  return prisma.booking.count({
    where: {
      customer_id: customerId,
      status: "REFUNDED",
    },
  });
}

static async getStaffFrequency(customerId: string) {
  const result = await prisma.booking.groupBy({
    by: ["staff_id"],
    where: {
      customer_id: customerId,
      status: { in: ["COMPLETED", "NO_SHOW"] },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const staff = await prisma.staff.findMany({
    where: { id: { in: result.map(r => r.staff_id) } },
    select: { id: true, name: true, avatar_url: true },
  });

  const staffMap = new Map(
  staff.map(s => [s.id, s])
);

return result.map(r => {
  const s = staffMap.get(r.staff_id);

  return {
    name: s?.name ?? "Unknown",
    avatar: s?.avatar_url ?? null,
    count: r._count.id,
  };
});
}


}



