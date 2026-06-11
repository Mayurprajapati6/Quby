import { prisma } from "../../../config/prisma";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, subMonths, endOfDay } from "date-fns";

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

const start = startOfDay(now);
const end = new Date(start);
end.setDate(end.getDate() + 1);

return prisma.booking.findMany({
  where: {
  staff_id: staffId,
  service_date: {
  gte: startOfDay(new Date())
},

status: {
  in: ["CONFIRMED", "RUNNING"]
},
  payment: {
    status: { in: ["PAID", "SETTLED"] }
  },
},
      include: {
        customer: { select: { name: true, avatar_url: true } },
      },
      orderBy: { queue_number: "asc" },
    });
  }

  static async getBookingCounts(staffId: string) {

  const [total, completed, refunded, noShow] = await Promise.all([

    prisma.booking.count({
      where: {
        staff_id: staffId,
        status: {
          in: ["COMPLETED", "REFUNDED", "NO_SHOW"]
        }
      }
    }),

    prisma.booking.count({
      where: {
        staff_id: staffId,
        status: "COMPLETED"
      }
    }),

    prisma.booking.count({
      where: {
        staff_id: staffId,
        status: "REFUNDED"
      }
    }),

    prisma.booking.count({
      where: {
        staff_id: staffId,
        status: "NO_SHOW"
      }
    }),

  ]);

  return { total, completed, refunded, noShow };
}

  static async getDurationAggregation(staffId: string, period: "week" | "month" | "year") {
    const since = periodStart(period);

    const result = await prisma.booking.aggregate({
      where: {
        staff_id:        staffId,
        status:          "COMPLETED",
        payment: {
  status: { in: ["PAID", "SETTLED"] }
},
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

  static async getPeriodRevenue(staffId: string) {
  const result = await prisma.booking.aggregate({
    where: {
      staff_id: staffId,
      status: "COMPLETED",
      payment: {
        status: { in: ["PAID", "SETTLED"] } // 👈 IMPORTANT
      }
    },
    _sum: { service_amount: true },
  });

  return result._sum.service_amount ?? 0;
}

  static async getMonthPerformance(staffId: string) {
    return prisma.staffPerformance.findUnique({
      where: { staff_id_month: { staff_id: staffId, month: startOfMonth(new Date()) } },
    });
  }

  static async getMonthlyRevenue(staffId: string) {
    const since = subMonths(startOfMonth(new Date()), 11);

    return prisma.booking.findMany({
      where: {
  staff_id: staffId,
  status: "COMPLETED",
  service_date: { gte: since },
  payment: {
    status: { in: ["PAID", "SETTLED"] }
  }
},
      select: { service_date: true, service_amount: true },
    });
  }

  static async getCompletedBookings(staffId: string, period: "week" | "month" | "year") {
    const since = periodStart(period);
    return prisma.booking.findMany({
      where:  {
  staff_id: staffId,
  status: "COMPLETED",
  service_date: { gte: since },
  payment: {
    status: { in: ["PAID", "SETTLED"] }
  }
},
      select: { services: true, service_amount: true },
    });
  }

  static async getPendingCounts(staffId: string) {
    const [leaves, notifications] = await Promise.all([
      prisma.staffLeave.count({ where: { staff_id: staffId, status: "PENDING" } }),
      prisma.staffNotification.count({ where: { staff_id: staffId, is_read: false } }),
    ]);
    return { leaves, notifications };
  }
  static async getPunctualityMetrics(staffId: string, period: "week" | "month" | "year") {
  const since = periodStart(period);

  const bookings = await prisma.booking.findMany({
    where: {
      staff_id: staffId,
      service_date: { gte: since },
      status: { in: ["COMPLETED", "RUNNING"] },
      payment: {
  status: { in: ["SETTLED"] }
},
      checked_in_at: { not: null },
    },
    select: {
  checked_in_at: true,
  service_start_time: true,
  service_started_at: true,
  total_delay: true,
}
  });

  let onTime = 0;
  let late = 0;
  let windowViolation = 0;
  let totalDelay = 0;

  let validCount = 0;

for (const b of bookings) {
  if (!b.checked_in_at || !b.service_start_time) continue;

  validCount++;

  const arrivalWindowEnd = new Date(b.service_start_time);
  arrivalWindowEnd.setMinutes(arrivalWindowEnd.getMinutes() - 5);

  if (b.checked_in_at <= arrivalWindowEnd) {
    onTime++;
  } else {
    late++;
  }

  if (
    b.service_started_at &&
    b.service_start_time &&
    b.service_started_at > b.service_start_time
  ) {
    windowViolation++;
  }

  totalDelay += b.total_delay ?? 0;
}

const total = validCount || 1;

  return {
    on_time_pct: Math.round((onTime / total) * 100),
    late_pct: Math.round((late / total) * 100),
    avg_delay: Math.round(totalDelay / total),
    window_violation_pct: Math.round((windowViolation / total) * 100),
  };
}

static async getDayWiseBookings(staffId: string) {

  const now = new Date();

  const start = startOfWeek(now, { weekStartsOn: 1 });

  const todayEnd = endOfDay(new Date());
  const end = todayEnd; // ✅ FIXED

  const data = await prisma.booking.groupBy({
    by: ["service_date"],
    where: {
      staff_id: staffId,
      service_date: {
        gte: start,
        lte: todayEnd
      },
      status: "COMPLETED",
      payment: {
        status: { in: ["PAID", "SETTLED"] }
      }
    },
    _count: { id: true },
  });

  console.log("📊 BOOKINGS RAW:", data); // 🔥 DEBUG

  return {
    range: { start, end },
    data: data.map(d => ({
      date: new Date(d.service_date.toDateString()),
      count: d._count.id
    }))
  };
}

static async getServiceWiseStats(staffId: string, period: "week" | "month" | "year") {
  const since = periodStart(period);

  const bookings = await prisma.booking.findMany({
   where: {
  staff_id: staffId,
  service_date: { gte: since },

  status: "COMPLETED",

  payment: {
    status: { in: ["PAID","SETTLED"] }
  }
},
    select: {
      services: true,
      service_amount: true 
    }
  });

  const map = new Map<string, {
  count: number;
  revenue: number;
  image?: string;
}>();

  for (const b of bookings) {

  let services: any[] = [];

if (Array.isArray(b.services)) {
  services = b.services;
} else if (typeof b.services === "string") {
  try {
    services = JSON.parse(b.services);
  } catch {
    services = [];
  }
}

// 🔥 CRITICAL FIX (DO NOT SKIP)
if (!services.length) {
  services = [{
    name: "Unknown",
    image_url: null
  }];
}

  const totalAmount = Number(b.service_amount ?? 0);

  const perService = services.length > 0
    ? totalAmount / services.length
    : 0;

  for (const s of services) {
    if (!s || typeof s !== "object") continue;

    const svc = s as Record<string, any>;

    const name =
      svc.name ??
      svc.service_name ??
      "Unknown";

    const image =
      svc.image_url ??
      svc.image ??
      svc.imageUrl ??
      null;

    const curr = map.get(name) ?? {
      count: 0,
      revenue: 0,
      image: null
    };

    map.set(name, {
      count: curr.count + 1,
      revenue: curr.revenue + perService, // ✅ FIXED
      image: curr.image ?? image
    });
  }
}

  return Array.from(map.entries()).map(([name, v]) => ({
  name,
  count: v.count,
  revenue: Math.round(v.revenue / 100),
  image: v.image ?? null
}));
}

static async getAllTimeServiceStats(staffId: string) {

  const bookings = await prisma.booking.findMany({
    where: {
      staff_id: staffId,
      status: "COMPLETED",
      payment: {
        status: { in: ["PAID", "SETTLED"] }
      }
    },
    select: {
      services: true,
      service_amount: true
    }
  });

  const map = new Map<string, {
    count: number;
    revenue: number;
    image?: string | null;
  }>();

  for (const b of bookings) {
    

    let services: any[] = [];

    if (Array.isArray(b.services)) {
      services = b.services;
    } else if (typeof b.services === "string") {
      try {
        services = JSON.parse(b.services);
      } catch {
        services = [];
      }
    }

    // fallback
    if (!services.length) {
      services = [{
        name: "Unknown",
        image_url: null
      }];
    }

    let totalAmount = Number(b.service_amount ?? 0)

// convert to INR properly
totalAmount = totalAmount / 100

// 🔥 USE REAL SERVICE PRICE IF AVAILABLE
let totalServicePrice = 0



// fallback (if price missing)
if (totalServicePrice === 0) {
  totalServicePrice = totalAmount
}

for (const s of services) {
  if (!s || typeof s !== "object") continue

  const svc = s as Record<string, any>

  const name =
    svc.name ??
    svc.service_name ??
    "Unknown"

  const image =
    svc.image_url ??
    svc.image ??
    null

  // 🔥 WEIGHTED SHARE (CORRECT)
  const svcPrice = Number(svc.price ?? 0) / 100
  const weight = totalServicePrice > 0 ? svcPrice / totalServicePrice : 1 / services.length

  const revenueShare = totalAmount * weight

  const curr = map.get(name) ?? {
    count: 0,
    revenue: 0,
    image: null
  }

  map.set(name, {
    count: curr.count + 1,
    revenue: curr.revenue + revenueShare,
    image: curr.image ?? image
  })
}

    
  }

  const arr = Array.from(map.entries()).map(([name, v]) => ({
  name,
  count: v.count,
  revenue: Math.round(v.revenue),
  image: v.image ?? null
}))

const totalRevenue = arr.reduce((sum, s) => sum + s.revenue, 0)

return arr.map(s => ({
  ...s,
  percentage: totalRevenue > 0
    ? Math.round((s.revenue / totalRevenue) * 100)
    : 0
}))
}

static async getDayWiseRevenue(staffId: string) {

  const now = new Date();

  const start = startOfWeek(now, { weekStartsOn: 1 });

  // ✅ IMPORTANT — ONLY TILL TODAY (NOT FULL WEEK)
  const todayEnd = endOfDay(new Date());
  const end = todayEnd;

  const data = await prisma.booking.groupBy({
    by: ["service_date"],
    where: {
      staff_id: staffId,

      service_date: {
        gte: start,
        lte: todayEnd // ✅ NO FUTURE
      },

      status: "COMPLETED",

      payment: {
        status: { in: ["PAID", "SETTLED"] }
      }
    },
    _sum: { service_amount: true },
  });

  // 🔥 DEBUG (VERY IMPORTANT — DON'T SKIP)
  console.log("💰 REVENUE RAW:", data);

  return {
    range: {
      start,
      end // ✅ now equals todayEnd
    },
    data: data.map(d => ({
      // ✅ REMOVE TIME (prevents duplicate days)
      date: new Date(d.service_date.toDateString()),

      // ✅ INR conversion
      revenue: Math.round((d._sum.service_amount ?? 0) / 100)
    }))
  };
}
}
