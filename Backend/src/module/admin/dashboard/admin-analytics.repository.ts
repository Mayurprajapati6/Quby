import { prisma } from "../../../config/prisma";
import { subDays, subMonths, startOfDay, startOfMonth, startOfYear, format } from "date-fns";

export class AdminAnalyticsRepository {

  static async getGrowthData(period: "daily" | "weekly" | "monthly") {
    const now = new Date();
    let since: Date;
    let groupFmt: string;

    if (period === "daily") {
      since = subDays(now, 29);  // last 30 days
      groupFmt = "YYYY-MM-DD";
    } else if (period === "weekly") {
      since = subDays(now, 83);  // last 12 weeks
      groupFmt = "IYYY-IW";
    } else {
      since = subMonths(startOfMonth(now), 11); // last 12 months
      groupFmt = "YYYY-MM";
    }

    const [customers, owners, staff, businesses] = await Promise.all([
      prisma.$queryRawUnsafe<{ period: string; count: bigint }[]>(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata', '${groupFmt}') AS period, COUNT(*) AS count
         FROM customers WHERE created_at >= $1 GROUP BY period ORDER BY period`,
        since
      ),
      prisma.$queryRawUnsafe<{ period: string; count: bigint }[]>(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata', '${groupFmt}') AS period, COUNT(*) AS count
         FROM owners WHERE created_at >= $1 GROUP BY period ORDER BY period`,
        since
      ),
      prisma.$queryRawUnsafe<{ period: string; count: bigint }[]>(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata', '${groupFmt}') AS period, COUNT(*) AS count
         FROM staff WHERE created_at >= $1 GROUP BY period ORDER BY period`,
        since
      ),
      prisma.$queryRawUnsafe<{ period: string; count: bigint }[]>(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata', '${groupFmt}') AS period, COUNT(*) AS count
         FROM businesses WHERE created_at >= $1 GROUP BY period ORDER BY period`,
        since
      ),
    ]);

    const allPeriods = Array.from(new Set([
      ...customers.map(r => r.period),
      ...owners.map(r => r.period),
      ...staff.map(r => r.period),
      ...businesses.map(r => r.period),
    ])).sort();

    const toMap = (rows: { period: string; count: bigint }[]) =>
      new Map(rows.map(r => [r.period, Number(r.count)]));

    const cMap = toMap(customers);
    const oMap = toMap(owners);
    const sMap = toMap(staff);
    const bMap = toMap(businesses);

    return allPeriods.map(p => ({
      period: p,
      customers: cMap.get(p) ?? 0,
      owners: oMap.get(p) ?? 0,
      staff: sMap.get(p) ?? 0,
      businesses: bMap.get(p) ?? 0,
    }));
  }

  static async getTopEarningBusinesses() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const yearStart  = startOfYear(now);

    const [monthly, yearly] = await Promise.all([
  prisma.booking.groupBy({
    by: ["business_id"],
    where: {
      service_date: { gte: monthStart },
      status: { in: ["COMPLETED", "NO_SHOW"] }, 
    },
    _count: { id: true },
    _sum: { service_amount: true },
    orderBy: {
      _sum: { service_amount: "desc" }, 
    },
    take: 8,
  }),

  prisma.booking.groupBy({
    by: ["business_id"],
    where: {
      service_date: { gte: yearStart },
      status: { in: ["COMPLETED", "NO_SHOW"] }, 
    },
    _count: { id: true },
    _sum: { service_amount: true },
    orderBy: {
      _sum: { service_amount: "desc" }, 
    },
    take: 8,
  }),
]);

    const allIds = Array.from(new Set([
      ...monthly.map(r => r.business_id),
      ...yearly.map(r => r.business_id),
    ]));

    const details = allIds.length
      ? await prisma.business.findMany({
          where: { id: { in: allIds } },
          select: { id: true, business_name: true, city: true, state: true, average_rating: true, service_for: true, logo_url: true },
        })
      : [];

    const dMap = new Map(details.map(d => [d.id, d]));

    const enrich = (rows: typeof monthly) =>
      rows.map(r => ({
        business_id:    r.business_id,
        business_name:  dMap.get(r.business_id)?.business_name ?? "—",
        city:           dMap.get(r.business_id)?.city ?? "—",
        state:          dMap.get(r.business_id)?.state ?? "—",
        service_for:    dMap.get(r.business_id)?.service_for ?? "—",
        average_rating: dMap.get(r.business_id)?.average_rating ?? 0,
        logo_url:       dMap.get(r.business_id)?.logo_url ?? null,
        booking_count:  r._count.id,
        revenue_inr:    (r._sum.service_amount ?? 0) / 100,
      }));

    return { monthly: enrich(monthly), yearly: enrich(yearly) };
  }

  static async getWeeklyServiceStats() {
    const bookings = await prisma.booking.findMany({
  where: {
    status: "COMPLETED",
  },
  select: { services: true },
});

    const countMap = new Map<string, { name: string; count: number }>();

    for (const booking of bookings) {
  const svcList = booking.services as any[];

  if (!Array.isArray(svcList)) continue;

  const seen = new Set<string>();

  

  for (const svc of svcList) {
    if (!svc) continue;

    const rawName =
      svc.name ??
      svc.service_name ??
      svc.platform_service_name ??
      "Unknown Service";

    const key = String(rawName).trim().toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);

    const entry = countMap.get(key) ?? {
      name: rawName,
      count: 0,
    };

    entry.count += 1;

    countMap.set(key, entry);
  }
}

    return Array.from(countMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  static async getCityDistribution() {
    const [bizByCity, customersByCity, ownersByCity, staffByCity] = await Promise.all([
      prisma.business.groupBy({
        by: ["city", "state"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 12,
      }),
      prisma.customer.groupBy({
        by: ["city", "state"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 12,
      }),
      prisma.owner.groupBy({
        by: ["city", "state"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 12,
      }),
      prisma.staff.groupBy({
        by: ["city"],
        where: { city: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 12,
      }),
    ]);

    const citySet = new Set(bizByCity.map(r => r.city));
    const cCityMap = new Map(customersByCity.map(r => [r.city, r._count.id]));
    const oCityMap = new Map(ownersByCity.map(r => [r.city, r._count.id]));
    const sCityMap = new Map(staffByCity.map(r => [r.city ?? "", r._count.id]));

    return bizByCity.map(r => ({
      city:       r.city,
      state:      r.state,
      businesses: r._count.id,
      customers:  cCityMap.get(r.city) ?? 0,
      owners:     oCityMap.get(r.city) ?? 0,
      staff:      sCityMap.get(r.city) ?? 0,
    }));
  }

  static async getSalonTypeDistribution() {
    const [men, unisex] = await Promise.all([
      prisma.business.count({ where: { service_for: "MEN" } }),
      prisma.business.count({ where: { service_for: "UNISEX" } }),
    ]);
    return { men, unisex };
  }

  static async getOwnerBusinessCount() {
    const rows = await prisma.owner.findMany({
      select: {
        id: true, name: true, avatar_url: true, city: true,
        _count: { select: { businesses: true } },
        businesses: { select: { is_active: true }, where: { is_active: true } },
      },
      orderBy: { total_businesses: "desc" },
      take: 10,
    });

    return rows.map(o => ({
      owner_id:          o.id,
      name:              o.name,
      avatar_url:        o.avatar_url,
      city:              o.city,
      total_businesses:  o._count.businesses,
      active_businesses: o.businesses.length,
    }));
  }

  static async getLifetimeCounts() {
    const [customers, owners, staff, businesses] = await Promise.all([
      prisma.customer.count(),
      prisma.owner.count(),
      prisma.staff.count({ where: { is_active: true } }),
      prisma.business.count(),
    ]);
    return { customers, owners, staff, businesses };
  }
}
