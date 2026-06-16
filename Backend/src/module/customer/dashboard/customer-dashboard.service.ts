import { CustomerDashboardRepository } from "./customer-dashboard.repository";
import { prisma } from "../../../config/prisma";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import type {
  CustomerDashboardDTO,
  DashboardFilters,
  MonthlySpendDTO,
  CalendarEventDTO,
} from "./customer-dashboard.types";
import { deriveArrivalEnd, deriveArrivalStart } from "../booking/booking.repository";

const IST = "Asia/Kolkata";
const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

function toIST(date: Date): string {
  return formatInTimeZone(date, IST, "yyyy-MM-dd'T'HH:mm:ssxxx");
}
function toISTDate(date: Date): string {
  return formatInTimeZone(date, IST, "yyyy-MM-dd");
}

export class CustomerDashboardService {

  static async getDashboard(
    userId:  string,
    filters: DashboardFilters = {},
  ): Promise<CustomerDashboardDTO> {

    const customer = await CustomerDashboardRepository.findCustomerWithWallet(userId);
    if (!customer) throw new NotFoundError("Customer profile not found.");

    const todayIST     = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
    const [year, month] = todayIST.split("-").map(Number);
    const filterMonth  = filters.month ?? month;
    const filterYear   = filters.year  ?? year;

    const [
  pendingReviewCount,
  nextBooking,
  recentBookings,
  pendingReviews,
  mostBookedSalon,
  mostBookedStaff,
  mostBookedService,
  monthlySpendRaw,
  calendarRaw,
  noShowCount,
  spendStats, // ✅ ADD
  bookingFrequency,
 bookingBreakdown,
 serviceUsage,
 businessFrequency,
 refundCount,
 staffFrequency,
] = await Promise.all([
  CustomerDashboardRepository.countPendingReviews(customer.id),
  CustomerDashboardRepository.findNextUpcomingBooking(customer.id),
  CustomerDashboardRepository.findRecentBookings(customer.id, 5),
  CustomerDashboardRepository.findPendingReviews(customer.id),
  CustomerDashboardRepository.findMostBookedSalon(customer.id),
  CustomerDashboardRepository.findMostBookedStaff(customer.id),
  CustomerDashboardRepository.findMostBookedService(customer.id),
  CustomerDashboardRepository.getMonthlySpend(customer.id, filterYear),
  CustomerDashboardRepository.getCalendarEvents(customer.id, filterMonth, filterYear),
  prisma.booking.count({ where: { customer_id: customer.id, status: "NO_SHOW" } }),

  // ✅ ADD THIS LINE
  CustomerDashboardRepository.getSpendStats(customer.id),
  CustomerDashboardRepository.getBookingFrequency(customer.id, filterYear),
CustomerDashboardRepository.getBookingBreakdown(customer.id),
CustomerDashboardRepository.getServiceUsage(customer.id),
CustomerDashboardRepository.getBusinessFrequency(customer.id),
CustomerDashboardRepository.getRefundCount(customer.id),
CustomerDashboardRepository.getStaffFrequency(customer.id),

]);

    const monthly_spend: MonthlySpendDTO[] = monthlySpendRaw.map(m => ({
      month:       m.month,
      year:        m.year,
      label:       `${MONTH_NAMES[m.month - 1]} ${m.year}`,
      amount_inr:  m.amount / 100,
      bookings:    m.count,
    }));

    const calendar_events = calendarRaw.map(b => ({
  booking_id: b.id,
  booking_number: b.booking_number,

  service_date: toISTDate(b.service_date),
  service_start_time: toIST(b.service_start_time),

  business_name: b.business.business_name,
  business_logo: b.business.logo_url ?? null,
  business_city: b.business.city,
  business_state: b.business.state,

  staff_name: b.staff.name,
  staff_avatar: b.staff.avatar_url ?? null,

  services: Array.isArray((b as any).services)
    ? (b as any).services.map((s: any) => s.name ?? "")
    : [],

  amount: ((b as any).service_amount ?? 0) / 100,

  payment_status:
  (b.payment?.refund_amount ?? 0) > 0
    ? "REFUNDED"
    : b.status === "NO_SHOW"
    ? "FAILED"
    : "PAID",

  status:
  b.status === "REFUNDED"
    ? "REFUNDED"
    : b.status === "COMPLETED"
    ? "COMPLETED"
    : b.status === "NO_SHOW"
    ? "NO_SHOW"
    : b.status === "CONFIRMED" || b.status === "RUNNING"
    ? "CONFIRMED"
    : "CONFIRMED",
}))
console.log("📅 CALENDAR RAW 👉", calendarRaw)
console.log("📅 CALENDAR EVENTS 👉", calendar_events)
    const upcoming_booking = nextBooking
      ? {
          id:                   nextBooking.id,
          booking_number:       nextBooking.booking_number,
          business_name:        nextBooking.business.business_name,
          business_logo:        nextBooking.business.logo_url ?? null,
          staff_name:           nextBooking.staff.name,
          staff_avatar:         nextBooking.staff.avatar_url  ?? null,
          service_date:         toISTDate(nextBooking.service_date),
          service_start_time:   toIST(nextBooking.service_start_time),
          arrival_window_start: toIST(
  deriveArrivalStart(nextBooking.service_start_time)
),
arrival_window_end: toIST(
  deriveArrivalEnd(nextBooking.service_start_time)
),
          services:             Array.isArray((nextBooking as any).services)
            ? (nextBooking as any).services.map((s: any) => s.name ?? "")
            : [],
          status:               nextBooking.status,
          qr_image_url:         (nextBooking as any).qr_code?.qr_image_url ?? null,
        }
      : null;

    const recent_bookings = recentBookings.map(b => ({
      id:             b.id,
      booking_number: b.booking_number,
      business_name:  b.business.business_name,
      business_logo:  b.business.logo_url ?? null,
      service_date:   toISTDate(b.service_date),
      service_start_time: toIST(b.service_start_time),
      status:         b.status,

      has_review:     !!(b as any).review,
    }));

    const pending_reviews = pendingReviews.map(b => ({
  booking_id:     b.id,
  booking_number: b.booking_number,
  business_id:    b.business.id,
  business_name:  b.business.business_name,
  staff_id:       b.staff.id,
  staff_name:     b.staff.name,
  service_date:   toISTDate(b.service_date),

  // ✅ FIX
  services: Array.isArray((b as any).services)
    ? (b as any).services.map((s: any) => s.name ?? "")
    : [],
}));

    const liveStats = await CustomerDashboardRepository.getBookingStats(customer.id);

    return {
      customer: {
        id:         customer.id,
        name:       customer.name,
        avatar_url: customer.avatar_url ?? null,
        username:   customer.username,
        city:       customer.city,
        state:      customer.state,
        join_date:  toISTDate(customer.created_at),
      },
      
      stats: {
  total_bookings:     liveStats.total,
  completed_bookings: liveStats.completed,
  cancelled_bookings: liveStats.cancelled,
  no_show_bookings:   liveStats.no_show,

  upcoming_bookings:  liveStats.upcoming,

  pending_reviews:    pendingReviewCount ?? 0,

  total_spent_inr:    spendStats.total_spent / 100,
  refunded_inr:       spendStats.refunded_amount / 100,
  refunded_bookings: refundCount,
},
      analytics: {
  booking_frequency: bookingFrequency,
  booking_breakdown: bookingBreakdown,
  service_usage: serviceUsage,
  business_frequency: businessFrequency,
  staff_frequency: staffFrequency,
},

      most_booked: {
        salon:   mostBookedSalon,
        staff:   mostBookedStaff,
        service: mostBookedService,
      },

      monthly_spend,
      upcoming_booking,
      recent_bookings,
      pending_reviews,
      calendar_events,

      
    };
    
  }
}
