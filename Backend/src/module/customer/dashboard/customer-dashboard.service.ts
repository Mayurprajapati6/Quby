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

    const now          = new Date(new Date().toLocaleString("en-US", { timeZone: IST }));
    const filterMonth  = filters.month ?? (now.getMonth() + 1);
    const filterYear   = filters.year  ?? now.getFullYear();

    const [
      favouriteCount,
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
    ] = await Promise.all([
      CustomerDashboardRepository.countFavourites(customer.id),
      CustomerDashboardRepository.countPendingReviews(customer.id),
      CustomerDashboardRepository.findNextUpcomingBooking(customer.id),
      CustomerDashboardRepository.findRecentBookings(customer.id, 5),
      CustomerDashboardRepository.findPendingReviews(customer.id),
      CustomerDashboardRepository.findMostBookedSalon(customer.id),
      CustomerDashboardRepository.findMostBookedStaff(customer.id),
      CustomerDashboardRepository.findMostBookedService(customer.id),
      CustomerDashboardRepository.getMonthlySpend(customer.id, filterYear),
      CustomerDashboardRepository.getCalendarEvents(customer.id, filterMonth, filterYear),
      prisma.booking.count({ where: { customer_id: customer.id, status: "CANCELLED_NO_SHOW" } }),
    ]);

    const monthly_spend: MonthlySpendDTO[] = monthlySpendRaw.map(m => ({
      month:       m.month,
      year:        m.year,
      label:       `${MONTH_NAMES[m.month - 1]} ${m.year}`,
      amount_inr:  m.amount / 100,
      bookings:    m.count,
    }));

    const calendar_events: CalendarEventDTO[] = calendarRaw.map(b => ({
      booking_id:     b.id,
      booking_number: b.booking_number,
      service_date:   toISTDate(b.service_date),
      service_start_time: toIST(b.service_start_time),
      business_name:  b.business.business_name,
      staff_name:     b.staff.name,
      status:         b.status,
    }));

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
          arrival_window_start: toIST(nextBooking.arrival_window_start),
          arrival_window_end:   toIST(nextBooking.arrival_window_end),
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
      total_amount:   (b as any).total_amount,
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
    }));

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
        total_bookings:     customer.total_bookings     ?? 0,
        completed_bookings: customer.completed_bookings ?? 0,
        cancelled_bookings: customer.cancelled_bookings ?? 0,
        no_show_bookings:   noShowCount,
        total_spent_inr:    (customer.total_spent ?? 0) / 100,
        total_favourites:   favouriteCount,
        pending_reviews:    pendingReviewCount,
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
