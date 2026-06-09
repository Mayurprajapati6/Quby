import { AdminDashboardRepository as Repo } from "./admin-dashboard.repository";
import { formatInTimeZone } from "date-fns-tz";
import {
  startOfWeek, startOfMonth, startOfYear,
  endOfWeek, endOfMonth, endOfYear,
  subMonths,
} from "date-fns";

const TZ     = "Asia/Kolkata";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toTZDate(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM-dd"); }
function tzMonthKey(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM"); }

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
    const key = formatInTimeZone(d, TZ, "yyyy-MM");
    map.set(key, {
      label:       MONTHS[parseInt(formatInTimeZone(d, TZ, "MM")) - 1],
      year:        parseInt(formatInTimeZone(d, TZ, "yyyy")),
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
      [allBusinesses, newBusinesses],
      todayActivity,
      [revToday, revPeriod, revAllTime, refundsMonth, revMonth],
      monthlyRaw,
      topBusinesses,
      topCities,
      [totalBookings, completedBookings, noShowBookings],
      refundedBookings
    ] = await Promise.all([
      Repo.getUserCounts(periodStart),
      Repo.getBusinessStats(periodStart, periodEnd),
      Repo.getTodayActivity(),
      Repo.getPaymentRevenue(periodStart, periodEnd),
      Repo.getMonthlyRevenue(),
      Repo.getTopBusinesses(),
      Repo.getTopCities(monthStart, monthEnd),
      Repo.getBookingCounts(periodStart, periodEnd),
      Repo.getRefundedBookings(periodStart, periodEnd),,
    ]);

    const [customerCount, ownerCount, staffCount, adminCount, newUsersInPeriod] = userCounts;

    const active    = allBusinesses.filter(b => b.is_active).length;
    const inactive  = allBusinesses.filter(b => !b.is_active).length;

    const todayCompleted = todayActivity.filter(b => b.status === "COMPLETED").length;
    const todayCancelled = todayActivity.filter(b => b.status === "CANCELLED").length;
    const todayNoShows   = todayActivity.filter(b => b.status === "NO_SHOW").length;
    const grossToday     = todayActivity.reduce((s, b) => s + (b.service_amount ?? 0), 0);

    const revTodayAmt   = revToday._sum.amount   ?? 0;
    const revPeriodAmt  = revPeriod._sum.amount  ?? 0;
    const revAllTimeAmt = revAllTime._sum.amount ?? 0;
    const refundsAmt    = refundsMonth._sum.refund_amount ?? 0;
    const revMonthAmt   = revMonth._sum.amount   ?? 0;

    const buckets = buildMonthBuckets();
    for (const row of monthlyRaw) {
      if (!row.settled_at) continue;
      const key    = tzMonthKey(row.settled_at);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.revenue_inr += row.amount / 100;
        bucket.count       += 1;
      }
    }

    return {
      period,

      users: {
        total_customers: customerCount,
        total_owners:    ownerCount,
        total_staff:     staffCount,
        total_admins:    adminCount,
        new_in_period:   newUsersInPeriod,
      },

      businesses: {
        total:         allBusinesses.length,
        active,
        inactive,
        new_in_period: newBusinesses,
      },

      today: {
        date:             toTZDate(now),
        total_bookings:   todayActivity.length,
        completed:        todayCompleted,
        cancelled:        todayCancelled,
        no_shows:         todayNoShows,
        gross_revenue_inr: grossToday / 100,
      },

      // Revenue = settled service amounts (no platform fee concept)
      revenue: {
        today_inr:          revTodayAmt  / 100,
        period_inr:         revPeriodAmt / 100,
        this_month_inr:     revMonthAmt  / 100,
        all_time_inr:       revAllTimeAmt / 100,
        refunds_this_month_inr: refundsAmt / 100,
        net_this_month_inr: (revMonthAmt - refundsAmt) / 100,
      },

      bookings: {
  period_total: totalBookings,
  period_completed: completedBookings,
  period_no_show: noShowBookings,
  period_refunded: refundedBookings, // ✅ NEW
},

      monthly_revenue: Array.from(buckets.values()),
      top_businesses:  topBusinesses,
      top_cities:      topCities,
    };
  }
}
