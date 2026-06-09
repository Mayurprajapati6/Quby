import { prisma } from "../../../config/prisma";
import { OwnerDashboardRepository as Repo } from "./owner-dashboard.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import { subMonths, startOfMonth } from "date-fns";
import type { OwnerDashboardDTO, MonthlyEarningPointDTO } from "./owner-dashboard.types";

const TZ     = "Asia/Kolkata";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function tzMonthKey(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM"); }

function buildMonthlyBuckets(year?: number): Map<string, {
  month: string;
  year: number;
  earning_inr: number;
  booking_count: number;
}> {
  const map = new Map();

  const y = year ?? new Date().getFullYear(); // 🔥 selected year

  for (let m = 0; m < 12; m++) {
    const d = new Date(y, m, 1);

    const key = formatInTimeZone(d, TZ, "yyyy-MM");

    map.set(key, {
      month: MONTHS[m],   // Jan → Dec
      year: y,
      earning_inr: 0,
      booking_count: 0,
    });
  }

  return map;
}

export class OwnerDashboardService {

  private static async getOwnerData(userId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    return { ownerId: owner.id, businessIds: businesses.map(b => b.id) };
  }

  static async getDashboard(userId: string, year: number): Promise<OwnerDashboardDTO> {
    const { businessIds } = await this.getOwnerData(userId);

    if (!businessIds.length) {
      return this.emptyDashboard();
    }

    const [
  businesses,
  bookingStats,
  staffCounts,
  pendingLeaves,
  monthlyPayments,
  bestStaffResult,
  periodBookings,
  earningsPerBiz,
  pendingPerBiz,
  businessWiseEarnings,
  staffPerformance,
  noShowEarnings,
  completedEarnings,
  upcomingEarnings,
  monthlyCompletedBookings,
  totalEarnings   // ✅ ADD THIS
] = await Promise.all([
  Repo.getBusinesses(businessIds),
  Repo.getBookingStats(businessIds),
  Repo.getStaffCounts(businessIds),
  Repo.getPendingLeaveCount(businessIds),
  Repo.getMonthlyEarnings(businessIds, year),
  Repo.getBestStaff(businessIds),
  Repo.getCompletedBookingsForPeriod(businessIds, year),
  Repo.getEarningsPerBusiness(businessIds),
  Repo.getPendingPerBusiness(businessIds),
  Repo.getBusinessWiseEarnings(businessIds),
  Repo.getStaffPerformance(businessIds, year),
  Repo.getNoShowEarnings(businessIds),
  Repo.getCompletedEarnings(businessIds),
  Repo.getUpcomingEarnings(businessIds),
  Repo.getMonthlyCompletedBookings(businessIds, year),

  Repo.getTotalEarningsFromBookings(businessIds) // ✅ ADD
]);

   const summary = {
  total_earnings_inr: totalEarnings / 100,
  
  no_show_earnings_inr: noShowEarnings / 100,

  // 🔥 ADD THESE TWO
  completed_earnings_inr: completedEarnings / 100,
  upcoming_earnings_inr: upcomingEarnings / 100,

  total_bookings: bookingStats.total,
  completed_bookings: bookingStats.completed,
  refunded_bookings: bookingStats.refunded,
  no_show_bookings: bookingStats.noShow,
  upcoming_bookings: bookingStats.upcoming,
  today_bookings: bookingStats.today,

  active_businesses: businesses.filter(b => b.is_active ?? true).length,
  total_businesses: businesses.length,

  total_staff: staffCounts.total,
  active_staff: staffCounts.active,

  pending_leaves: pendingLeaves,
};

    const businessCards = businesses.map(b => ({
      id:                 b.id,
      business_name:      b.business_name,
      primary_image: b.logo_url ?? (b as any).images?.[0]?.image_url ?? null,
      average_rating:     b.average_rating  ?? 0,
      total_reviews:      b.total_reviews   ?? 0,
      total_bookings:     (b as any)._count?.bookings ?? 0,
      active_staff:       (b as any)._count?.staff    ?? 0,
      settled_earning_inr: (earningsPerBiz.get(b.id) ?? 0) / 100,
      pending_earning_inr: (pendingPerBiz.get(b.id)  ?? 0) / 100,
    }));
const totalRevenue = businessWiseEarnings.reduce(
  (sum, b) => sum + (b._sum.service_amount  ?? 0),
  0
);

const businessWiseChart = businesses.map(b => {
  const found = businessWiseEarnings.find(e => e.business_id === b.id);
  const revenue = found?._sum.service_amount  ?? 0;

  return {
    business_id: b.id,
    business_name: b.business_name,
    logo: b.logo_url ?? (b as any).images?.[0]?.image_url ?? null,
    earning_inr: revenue / 100,
    percentage: totalRevenue
      ? Number(((revenue / totalRevenue) * 100).toFixed(1))
      : 0,
  };
});

const staffChart = staffPerformance
  .sort((a, b) => b.earning_inr - a.earning_inr)
  .slice(0, 7);

    const bestStaff = bestStaffResult ? {
      id:                 bestStaffResult.staff.id,
      name:               bestStaffResult.staff.name,
      avatar_url:         bestStaffResult.staff.avatar_url    ?? null,
      business_name:      (bestStaffResult.staff as any).business?.business_name ?? "",
      average_rating:     bestStaffResult.staff.average_rating ?? 0,
      total_reviews:      bestStaffResult.staff.total_reviews  ?? 0,
      period_bookings:    bestStaffResult.period_bookings,
      period_earning_inr: bestStaffResult.period_earning / 100,
    } : null;

    // Monthly earnings chart
    const buckets = buildMonthlyBuckets(year);
    for (const p of monthlyPayments) {
  if (!p.settled_at) continue;

  const d = p.settled_at;
  if (d.getFullYear() !== year) continue;

  const key = tzMonthKey(d);
  const bucket = buckets.get(key);
  if (bucket) {
    bucket.earning_inr += p.amount / 100;
  }
}

for (const b of monthlyCompletedBookings) {
  const d = b.service_date;
  if (d.getFullYear() !== year) continue;

  const key = tzMonthKey(d);
  const bucket = buckets.get(key);
  if (bucket) {
    bucket.booking_count += 1;
  }
}

   const monthlyEarnings: MonthlyEarningPointDTO[] = Array.from(buckets.values());

// 🔥 Top services (FIXED)
const serviceAgg = new Map<
  string,
  { name: string; image: string | null; count: number; revenue: number }
>();

for (const booking of periodBookings) {
  const services = Array.isArray(booking.services) ? booking.services : [];

  for (const svc of services) {
    if (!svc || typeof svc !== "object") continue;

    const svcObj = svc as Record<string, any>;

    const id    = svcObj.service_id ?? svcObj.id ?? svcObj.name;
    const name  = svcObj.name ?? "Unknown";
    const image = svcObj.image_url ?? null;

    // ✅ REAL PRICE (THIS FIXES YOUR BUG)
    const price = (svcObj.price ?? 0) / 100;

    const key = id;

    const current = serviceAgg.get(key) ?? {
      name,
      image,
      count: 0,
      revenue: 0,
    };

    serviceAgg.set(key, {
      name,
      image,
      count: current.count + 1,   // ✅ COUNT LOGIC
      revenue: current.revenue + price, // ✅ CORRECT REVENUE
    });
  }
}

const totalServiceRevenue = Array.from(serviceAgg.values())
  .reduce((sum, s) => sum + s.revenue, 0);

const topServices = Array.from(serviceAgg.values())
  .map(v => ({
    name: v.name,
    count: v.count,
    revenue: Math.round(v.revenue * 100) / 100,
    percentage: totalServiceRevenue
      ? Number(((v.revenue / totalServiceRevenue) * 100).toFixed(1))
      : 0,
    image: v.image,
  }))
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 7);
    
    console.log("🚀 TOP SERVICES FINAL:", topServices);
    return {
  summary,
  businesses: businessCards,
  best_staff: bestStaff,
  monthly_earnings: monthlyEarnings,
  top_services: topServices,

  business_chart: businessWiseChart,
  staff_chart: staffChart,


};
  }

  private static emptyDashboard(): OwnerDashboardDTO {
    const buckets = buildMonthlyBuckets();
    return {
  summary: {
  total_earnings_inr: 0,

  no_show_earnings_inr: 0,

  // 🔥 ADD THESE TWO
  completed_earnings_inr: 0,
  upcoming_earnings_inr: 0,

  total_bookings: 0,
  completed_bookings: 0,
  refunded_bookings: 0,
  no_show_bookings: 0,
  upcoming_bookings: 0,
  today_bookings: 0,

  active_businesses: 0,
  total_businesses: 0,

  total_staff: 0,
  active_staff: 0,

  pending_leaves: 0,
},

  businesses: [],
  best_staff: null,
  monthly_earnings: Array.from(buckets.values()),
  top_services: [],

  // 🔥 ADD THESE
  business_chart: [],
  staff_chart: [],


};
  }
}