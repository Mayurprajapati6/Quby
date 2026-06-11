import { StaffDashboardRepository as Repo } from "./staff-dashboard.repository";
import { NotFoundError, ForbiddenError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import { startOfMonth, subMonths } from "date-fns";
import { deriveArrivalEnd, deriveServiceEnd } from "../../customer/booking/booking.repository";

const IST    = "Asia/Kolkata";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }
function istMonthKey(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM"); }

function buildMonthBuckets() {
  const map = new Map<string, { month: string; year: number; revenue_inr: number; count: number }>();
  const now  = new Date();
  for (let i = 11; i >= 0; i--) {
    const d   = subMonths(startOfMonth(now), i);
    const key = formatInTimeZone(d, IST, "yyyy-MM");
    map.set(key, {
      month:       MONTHS[parseInt(formatInTimeZone(d, IST, "MM")) - 1],
      year:        parseInt(formatInTimeZone(d, IST, "yyyy")),
      revenue_inr: 0,
      count:       0,
    });
  }
  return map;
}

export class StaffDashboardService {

  static async getDashboard(
  userId: string,
  period: "week" | "month" | "year",
  svcPeriod: "week" | "month" | "year" = "month"
){
    const staff = await Repo.findStaff(userId);
    if (!staff)           throw new NotFoundError("Staff profile not found.");
    if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");

  const [
  todayBookings,
  bookingCounts,
  revenue,
  monthPerf,
  monthlyRaw,
  periodBookings,
  pending,
  durationAgg,
  punctuality,
  dayWise,
  allTimeServiceStats,   // 🔥 ADD THIS
  dayWiseRevenue
] = await Promise.all([
  Repo.findTodayBookings(staff.id),
  Repo.getBookingCounts(staff.id),
  Repo.getPeriodRevenue(staff.id),
  Repo.getMonthPerformance(staff.id),
  Repo.getMonthlyRevenue(staff.id),
  Repo.getCompletedBookings(staff.id, period),
  Repo.getPendingCounts(staff.id),
  Repo.getDurationAggregation(staff.id, period),
  Repo.getPunctualityMetrics(staff.id, period),

  Repo.getDayWiseBookings(staff.id),

  Repo.getAllTimeServiceStats(staff.id),        // 🔥 ADD
  Repo.getDayWiseRevenue(staff.id),
]);

    const todayDate     = toISTDate(new Date());
    const running       = todayBookings.filter(b => ["CHECKED_IN","RUNNING"].includes(b.status));
    const now = new Date();

    const upcomingBookings = todayBookings;

const upcoming = upcomingBookings.length;

const nextBooking = upcomingBookings[0] ?? null;
    const completedToday = todayBookings.filter(b => b.status === "COMPLETED").length;

    const currentBooking = running[0] ?? null;
   

    function toTodayItem(b: any) {
      return {
        id:             b.id,
        booking_number: b.booking_number,
        queue_number:   b.queue_number,
        status:         b.status,
        customer_name:  b.customer.name,
        customer_avatar: b.customer.avatar_url ?? null,
        services:       Array.isArray(b.services) ? b.services.map((s: any) => s.name ?? "") : [],
        arrival_window_end: toIST(
  deriveArrivalEnd(b.service_start_time)
),
service_end_time: toIST(
  deriveServiceEnd(b.service_start_time, b.estimated_duration)
),
      };
    }

    const denom    = bookingCounts.completed + bookingCounts.refunded;
    const accuracy = denom > 0 ? Math.round((bookingCounts.completed / denom) * 100) : 100;

    const monthStats = monthPerf
      ? {
          on_time_count:      monthPerf.on_time_count,
          delayed_count:      monthPerf.delayed_count,
          on_time_percentage: monthPerf.total_bookings > 0
            ? Math.round((monthPerf.on_time_count / monthPerf.total_bookings) * 100) : 0,
          avg_delay_minutes:  Math.round(monthPerf.avg_delay_minutes),
          average_efficiency: Math.round(monthPerf.average_efficiency),
        }
      : { on_time_count: 0, delayed_count: 0, on_time_percentage: 0, avg_delay_minutes: 0, average_efficiency: 0 };

    const buckets = buildMonthBuckets();
    for (const b of monthlyRaw) {
      
      const key    = istMonthKey(b.service_date);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.revenue_inr += b.service_amount / 100;
        bucket.count       += 1;
      }
    }

    const topServices = ((allTimeServiceStats ?? []) as Array<{
  name: string;
  count: number;
  revenue: number;
  image?: string | null;
}>)
  .sort((a, b) => b.count - a.count)
  .slice(0, 3)
  .map(s => ({
    name: s.name,
    count: s.count,
    revenue_inr: s.revenue,
    image: s.image ?? null
  }));

    return {
      period,
      staff: {
        id:               staff.id,
        name:             staff.name,
        avatar_url:       staff.avatar_url     ?? null,
        specialization:   staff.specialization ?? null,
        experience_years: staff.experience_years ?? null,
        average_rating:   staff.average_rating  ?? 0,
        total_reviews:    staff.total_reviews   ?? 0,
        business_name:    (staff as any).business.business_name,
      },
      today: {
        date:              todayDate,
        total:             todayBookings.length,
        completed:         completedToday,
        running:           running.length,
        upcoming:          upcoming,
        current_booking:   currentBooking ? toTodayItem(currentBooking) : null,
        next_booking:      nextBooking    ? toTodayItem(nextBooking)    : null,
      },
       summary: {
    period_bookings: bookingCounts.total,
    completed: bookingCounts.completed,
    refunded: bookingCounts.refunded,
    no_show: bookingCounts.noShow,
    revenue_inr: revenue / 100,
  },
  service_wise_stats: allTimeServiceStats,
  day_wise_bookings: dayWise.data,
  
day_wise_revenue: dayWiseRevenue.data,
day_range: {
  start: dayWise.range.start,
  end: dayWise.range.end
},

  month_performance: monthStats,
  performance_timing: durationAgg,
  monthly_revenue: Array.from(buckets.values()),
  top_services: topServices,

  pending: {
    leave_requests: pending.leaves,
    unread_notifications: pending.notifications,
  },
    };
  }

  
}
