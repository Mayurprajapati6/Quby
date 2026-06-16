import { prisma } from "../../../config/prisma";
import { BusinessDashboardRepository as Repo } from "./business-dashboard.repository";
import { formatInTimeZone } from "date-fns-tz";
import { subMonths, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import type {
  BusinessDashboardDTO,
  StaffPerformanceCardDTO,
  MonthlyEarningPointDTO,
  TopServiceDTO,
  BestStaffDTO,
} from "./business-dashboard.types";

const TZ     = "Asia/Kolkata";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function tzMonthKey(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM"); }

function buildMonthBuckets() {
  const map = new Map<string, MonthlyEarningPointDTO>();
  const now  = new Date();
  for (let i = 11; i >= 0; i--) {
    const d   = subMonths(startOfMonth(now), i);
    const key = formatInTimeZone(d, TZ, "yyyy-MM");
    map.set(key, {
      month:         MONTHS[parseInt(formatInTimeZone(d, TZ, "MM")) - 1],
      year:          parseInt(formatInTimeZone(d, TZ, "yyyy")),
      earning_inr:   0,
      booking_count: 0,
    });
  }
  return map;
}

export class BusinessDashboardService {

  static async getDashboard(
    businessId: string,
    period:     "week" | "month" | "year",
    ownerUserId?: string,
  ): Promise<BusinessDashboardDTO> {

    // ✅ FIX: verify this business belongs to the requesting owner
    if (ownerUserId) {
      const owner = await prisma.owner.findFirst({ where: { user_id: ownerUserId } });
      const belongs = owner
        ? await prisma.business.findFirst({ where: { id: businessId, owner_id: owner.id } })
        : null;
      if (!belongs) {
        const { NotFoundError } = await import("../../../utils/errors/app.error");
        throw new NotFoundError("Business not found or does not belong to your account.");
      }
    }

    // ✅ FIX: BusinessWallet model does not exist in schema — removed prisma.businessWallet call
    const [
      earnings,
      bookingCounts,
      staffCounts,
      pendingLeaves,
      staffList,
      { completed: completedGroups, cancelled: cancelledGroups },
      monthlyPayments,
      periodBookings,
      ratings,
    ] = await Promise.all([
      Repo.getEarnings(businessId),
      Repo.getBookingCounts(businessId),
      Repo.getStaffCounts(businessId),
      Repo.getPendingLeaveCount(businessId),
      Repo.getStaff(businessId),
      Repo.getStaffCompletionStats(businessId, period),
      Repo.getMonthlyEarnings(businessId),
      Repo.getCompletedBookings(businessId, period),
      Repo.getBusinessRatings(businessId),
    ]);

    const summary = {
      total_earnings_inr:     earnings.settled / 100,
      available_balance_inr:  earnings.settled / 100,
      pending_earnings_inr:   earnings.pending / 100,
      total_bookings:         bookingCounts.total,
      completed_bookings:     bookingCounts.completed,
      cancelled_bookings:     bookingCounts.cancelled,
      today_bookings:         bookingCounts.today,
      average_rating:         ratings?.average_rating ?? 0,
      total_reviews:          ratings?.total_reviews  ?? 0,
      active_staff:           staffCounts.active,
      total_staff:            staffCounts.total,
      pending_leave_requests: pendingLeaves,
    };

    const completedMap = new Map(
      completedGroups.map(g => [g.staff_id, { count: g._count.id, earning: g._sum.service_amount ?? 0 }]),
    );
    const cancelledMap = new Map(
      cancelledGroups.map(g => [g.staff_id, g._count.id]),
    );

    const staffIds   = staffList.map(s => s.id);
    const _now       = new Date();
    const _periodStart = period === "week"
      ? startOfWeek(_now, { weekStartsOn: 1 })
      : period === "year"
        ? startOfYear(_now)
        : startOfMonth(_now);

    const perfRecords = await prisma.staffPerformance.findMany({
      where: { staff_id: { in: staffIds }, month: { gte: _periodStart } },
    });
    const perfMap = new Map<string, { totalBookings: number; totalActual: number; totalEst: number; onTime: number; effSum: number }>();
    for (const r of perfRecords) {
      const prev = perfMap.get(r.staff_id) ?? { totalBookings: 0, totalActual: 0, totalEst: 0, onTime: 0, effSum: 0 };
      perfMap.set(r.staff_id, {
        totalBookings: prev.totalBookings + r.total_bookings,
        totalActual:   prev.totalActual   + r.total_actual_minutes,
        totalEst:      prev.totalEst      + r.total_estimated_minutes,
        onTime:        prev.onTime        + r.on_time_count,
        effSum:        prev.effSum        + r.average_efficiency * r.total_bookings,
      });
    }

    const staffPerformance: StaffPerformanceCardDTO[] = staffList.map(s => {
      const comp    = completedMap.get(s.id) ?? { count: 0, earning: 0 };
      const canc    = cancelledMap.get(s.id) ?? 0;
      const denom   = comp.count + canc;
      const accuracy = denom > 0 ? Math.round((comp.count / denom) * 100) : 100;
      const perf     = perfMap.get(s.id);
      const tb       = perf?.totalBookings ?? 0;

      return {
        id:                 s.id,
        name:               s.name,
        avatar_url:         s.avatar_url     ?? null,
        average_rating:     s.average_rating ?? 0,
        total_reviews:      s.total_reviews  ?? 0,
        period_bookings:    comp.count,
        period_earning_inr: comp.earning / 100,
        accuracy_percent:   accuracy,
        avg_taken_min:      tb > 0 ? Math.round((perf!.totalActual) / tb) : 0,
        avg_estimated_min:  tb > 0 ? Math.round((perf!.totalEst)    / tb) : 0,
        avg_efficiency_pct: tb > 0 ? Math.round((perf!.effSum)      / tb) : 100,
        on_time_pct:        tb > 0 ? Math.round((perf!.onTime / tb) * 100) : 100,
      };
    });

    const topPerformer = [...staffPerformance].sort((a, b) => b.period_bookings - a.period_bookings)[0] ?? null;
    const bestStaff: BestStaffDTO | null = topPerformer && topPerformer.period_bookings > 0
      ? { id: topPerformer.id, name: topPerformer.name, avatar_url: topPerformer.avatar_url, average_rating: topPerformer.average_rating, period_bookings: topPerformer.period_bookings, period_earning_inr: topPerformer.period_earning_inr }
      : null;

    // Monthly earnings from Payment.settled_at
    const buckets = buildMonthBuckets();
    for (const p of monthlyPayments) {
      if (!p.settled_at) continue;
      const key    = tzMonthKey(p.settled_at);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.earning_inr   += p.amount / 100;
        bucket.booking_count += 1;
      }
    }
    const monthlyEarnings = Array.from(buckets.values());

    const svcAgg = new Map<string, { count: number; revenue: number }>();
    for (const b of periodBookings) {
      const services = Array.isArray(b.services) ? b.services : [];
      for (const svc of services) {
        if (!svc || typeof svc !== "object") continue;
        const svcObj  = svc as Record<string, any>;
        const name    = svcObj.name ?? "Unknown";
        const price   = typeof svcObj.price === "number" ? svcObj.price : 0;
        const current = svcAgg.get(name) ?? { count: 0, revenue: 0 };
        svcAgg.set(name, { count: current.count + 1, revenue: current.revenue + price });
      }
    }
    const topServices: TopServiceDTO[] = Array.from(svcAgg.entries())
      .map(([name, v]) => ({ name, count: v.count, revenue_inr: Math.round(v.revenue / 100 * 100) / 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { summary, staff_performance: staffPerformance, best_staff: bestStaff, top_services: topServices, monthly_earnings: monthlyEarnings, period };
  }
}
