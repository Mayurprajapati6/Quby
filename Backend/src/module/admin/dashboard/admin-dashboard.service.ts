import { AdminDashboardRepository as Repo } from "./admin-dashboard.repository";
import { formatInTimeZone } from "date-fns-tz";
import {
  startOfWeek, startOfMonth, startOfYear,
  endOfWeek, endOfMonth, endOfYear,
  subMonths,
} from "date-fns";

const IST    = "Asia/Kolkata";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }
function istMonthKey(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM"); }

function periodBounds(period: "week" | "month" | "year") {
  const now = new Date();
  if (period === "week")  return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  if (period === "month") return { start: startOfMonth(now), end: endOfMonth(now) };
  return                         { start: startOfYear(now),  end: endOfYear(now)  };
}

function buildMonthBuckets() {
  const map = new Map<string, { label: string; year: number; revenue_inr: number; count: number }>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d   = subMonths(startOfMonth(now), i);
    const key = formatInTimeZone(d, IST, "yyyy-MM");
    map.set(key, {
      label:       MONTHS[parseInt(formatInTimeZone(d, IST, "MM")) - 1],
      year:        parseInt(formatInTimeZone(d, IST, "yyyy")),
      revenue_inr: 0,
      count:       0,
    });
  }
  return map;
}

export class AdminDashboardService {

  static async getDashboard(period: "week" | "month" | "year") {
    const { start: periodStart, end: periodEnd } = periodBounds(period);
    const monthStart = startOfMonth(new Date());
    const monthEnd   = endOfMonth(new Date());
    const now        = new Date();

    const [
      userCounts,
      [allBusinesses, newBusinesses, pendingVerification],
      todayActivity,
      [feeToday, feePeriod, feeAllTime, refundsMonth, feeMonth],
      monthlyRaw,
      topBusinesses,
      topCities,
      [totalBookings, completedBookings, cancelledBookings],
    ] = await Promise.all([
      Repo.getUserCounts(periodStart),
      Repo.getBusinessStats(periodStart, periodEnd),
      Repo.getTodayActivity(),
      Repo.getPlatformRevenue(periodStart, periodEnd),
      Repo.getMonthlyRevenue(),
      Repo.getTopBusinesses(monthStart, monthEnd),
      Repo.getTopCities(monthStart, monthEnd),
      Repo.getBookingCounts(periodStart, periodEnd),
    ]);

    const [
      customerCount, ownerCount, staffCount, adminCount,
      newUsersInPeriod, suspendedUsers,
    ] = userCounts;

    const verified  = allBusinesses.filter(b => b.is_verified).length;
    const active    = allBusinesses.filter(b => b.is_active).length;
    const inactive  = allBusinesses.filter(b => !b.is_active).length;

    const todayCompleted = todayActivity.filter(b => b.status === "COMPLETED").length;
    const todayCancelled = todayActivity.filter(b =>
      ["CANCELLED", "CANCELLED_TIMEOUT"].includes(b.status),
    ).length;
    const todayNoShows   = todayActivity.filter(b => b.status === "CANCELLED_NO_SHOW").length;
    const grossToday     = todayActivity.reduce((s, b) => s + (b.service_amount ?? 0), 0);

    const feeTodayAmt   = feeToday._sum.amount   ?? 0;
    const feePeriodAmt  = feePeriod._sum.amount  ?? 0;
    const feeAllTimeAmt = feeAllTime._sum.amount ?? 0;
    const refundsAmt    = refundsMonth._sum.refund_amount ?? 0;
    const feeMonthAmt   = feeMonth._sum.amount   ?? 0;

    const buckets = buildMonthBuckets();
    for (const row of monthlyRaw) {
      const key    = istMonthKey(row.collected_at);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.revenue_inr += row.amount / 100;
        bucket.count       += 1;
      }
    }

    return {
      period,

      users: {
        total_customers:  customerCount,
        total_owners:     ownerCount,
        total_staff:      staffCount,
        total_admins:     adminCount,
        new_in_period:    newUsersInPeriod,
        suspended:        suspendedUsers,
      },

      businesses: {
        total:                allBusinesses.length,
        verified,
        unverified:           allBusinesses.length - verified,
        pending_verification: pendingVerification,
        active,
        inactive,
        new_in_period:        newBusinesses,
      },

      today: {
        date:             toISTDate(now),
        total_bookings:   todayActivity.length,
        completed:        todayCompleted,
        cancelled:        todayCancelled,
        no_shows:         todayNoShows,
        platform_revenue_inr: feeTodayAmt / 100,
        gross_bookings_inr:   grossToday  / 100,
      },

      revenue: {
        today_inr:           feeTodayAmt  / 100,
        period_inr:          feePeriodAmt / 100,
        this_month_inr:      feeMonthAmt  / 100,
        all_time_inr:        feeAllTimeAmt / 100,
        refunds_this_month_inr: refundsAmt / 100,
        net_this_month_inr:  (feeMonthAmt - refundsAmt) / 100,
      },

      bookings: {
        period_total:     totalBookings,
        period_completed: completedBookings,
        period_cancelled: cancelledBookings,
        completion_rate:  totalBookings > 0
          ? Math.round((completedBookings / totalBookings) * 100) : 0,
      },

      monthly_revenue: Array.from(buckets.values()),

      top_businesses: topBusinesses,

      top_cities: topCities,

      pending: {
        verification_queue: pendingVerification,
      },
    };
  }
}
