import { prisma } from "../../../config/prisma";
import { endOfMonth, startOfDay, sub } from "date-fns";

export class CustomerDashboardRepository {

  static async findCustomerWithWallet(userId: string) {
    return prisma.customer.findUnique({
      where:   { user_id: userId },
      include: {
        wallet: { select: { balance: true } },
      },
    });
  }

  static async countFavourites(customerId: string) {
    return prisma.customerFavourite.count({ where: { customer_id: customerId } });
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
        status:       { in: ["CONFIRMED", "CHECKED_IN"] },
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
      include: {
        business: { select: { id: true, business_name: true } },
        staff:    { select: { id: true, name: true } },
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
        status:       "COMPLETED",
        service_date: {
          gte: new Date(`${filterYear}-01-01T00:00:00+05:30`),
          lte: new Date(`${filterYear}-12-31T23:59:59+05:30`),
        },
      },
      select: { service_date: true, service_amount: true, total_amount: true },
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
    const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`);
    const monthEnd   = endOfMonth(monthStart);

    return prisma.booking.findMany({
      where: {
        customer_id:  customerId,
        status:       { in: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"] },
        service_date: { gte: monthStart, lte: monthEnd },
      },
      include: {
        business: { select: { business_name: true } },
        staff:    { select: { name: true } },
      },
      orderBy: [{ service_date: "asc" }, { service_start_time: "asc" }],
    });
  }
}
