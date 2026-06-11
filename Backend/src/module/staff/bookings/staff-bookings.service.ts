import { prisma } from "../../../config/prisma";
import { StaffBookingsRepository } from "./staff-bookings.repository";
import { NotFoundError, ForbiddenError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import { addMinutes } from "date-fns";
import {
  bookingWindowStart,
  deriveArrivalWindowEnd,
  deriveArrivalWindowStart,
  deriveScanWindowEnd,
  deriveServiceEnd,
} from "../../../utils/helpers/timeWindows";

const IST = "Asia/Kolkata";
function toIST(d: Date)     { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

async function resolveStaff(userId: string) {
  const staff = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, is_active: true },
  });
  if (!staff)           throw new NotFoundError("Staff profile not found.");
  if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");
  return staff;
}

function deriveWindows(serviceStart: Date, estimatedDuration: number) {
  return {
    arrival_window_start: deriveArrivalWindowStart(serviceStart),
    arrival_window_end:   deriveArrivalWindowEnd(serviceStart),
    scan_window_end:      deriveScanWindowEnd(serviceStart),
    service_end_time:     deriveServiceEnd(serviceStart, estimatedDuration),
  };
}


function toListItem(b: any) {
  const rawStart = new Date(b.service_start_time);
  const start    = bookingWindowStart(rawStart);
  const windows  = deriveWindows(rawStart, b.estimated_duration);

  return {
    id:             b.id,
    booking_number: b.booking_number,
    status:         b.status,
    service_date:   toISTDate(b.service_date),
    queue_number:   b.queue_number,
    service_start_time:   toIST(start),
    arrival_window_start: toIST(windows.arrival_window_start),
    arrival_window_end:   toIST(windows.arrival_window_end),
    scan_window_end:      toIST(windows.scan_window_end),
    service_end_time:     toIST(windows.service_end_time),
    estimated_duration:   b.estimated_duration,
    //Services: both keys for BookingCard + detail modal compatibility
    services: Array.isArray(b.services)
      ? b.services.map((s: any) => ({
          name:             s.name            ?? "",
          duration:         s.duration_minutes ?? null,  // BookingCard reads duration
          duration_minutes: s.duration_minutes ?? null,  // detail modal reads duration_minutes
          image:            s.image_url        ?? null,  // BookingCard ServiceImg reads image
          image_url:        s.image_url        ?? null,  // detail modal ServiceImg reads image_url
          price:            s.price            ?? null,
        }))
      : [],
    service_amount: b.service_amount,
    // Customer always as object — BookingCard reads booking.customer?.name etc.
    customer: {
      id:         b.customer.id,
      name:       b.customer.name,
      phone:      b.customer.phone      ?? null,
      avatar_url: b.customer.avatar_url ?? null,
    },
    has_review: !!(b.review),
    // service_started_at — null = awaiting QR, set = in progress
    service_started_at: b.service_started_at
      ? toIST(b.service_started_at) : null,
    // actual_start_time alias (card row 2 time display)
    actual_start_time: b.service_started_at
      ? toIST(b.service_started_at) : null,
    actual_end_time: b.service_completed_at
      ? toIST(b.service_completed_at) : null,
    actual_duration: b.actual_duration ?? null,
  };
}

export class StaffBookingsService {

  static async getBookings(
    userId: string,
    opts:   { status?: string; date?: string; page: number; limit: number },
  ) {
    const staff = await resolveStaff(userId);
    const { bookings, total } = await StaffBookingsRepository.find(staff.id, {
      status: opts.status,
      date:   opts.date,
      skip:   (opts.page - 1) * opts.limit,
      take:   opts.limit,
    });

    // CRITICAL: Read path returns DB truth as-is.
    // Do NOT apply any in-memory chain/overlap logic here.
    const mapped = bookings.map(b => toListItem(b));

    return {
      bookings: mapped,
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getBookingDetail(userId: string, bookingId: string) {
    const staff   = await resolveStaff(userId);
    const booking = await StaffBookingsRepository.findById(bookingId, staff.id);
    if (!booking) throw new NotFoundError("Booking not found.");

    const b       = booking as any;
    const rawStart = new Date(b.service_start_time);
    const start    = bookingWindowStart(rawStart);
    const windows  = deriveWindows(rawStart, b.estimated_duration);

    return {
      // Spread all list fields (includes service_started_at, customer object, etc.)
      ...toListItem(b),

      // Detail-only fields
      notes:               b.notes               ?? null,
      cancellation_reason: b.cancellation_reason  ?? null,

      service_start_time:   toIST(start),
      arrival_window_start: toIST(windows.arrival_window_start),
      arrival_window_end:   toIST(windows.arrival_window_end),
      scan_window_end:      toIST(windows.scan_window_end),
      service_end_time:     toIST(windows.service_end_time),

      checked_in_at: b.checked_in_at ? toIST(b.checked_in_at) : null,

      service_started_at: b.service_started_at
        ? toIST(b.service_started_at) : null,

      // actual_start_time alias for timeline row
      actual_start_time: b.service_started_at
        ? toIST(b.service_started_at) : null,

      // completed_at for "Service completed at X" banner
      completed_at: b.service_completed_at
        ? toIST(b.service_completed_at) : null,

      cancelled_at: b.cancelled_at ? toIST(b.cancelled_at) : null,

      actual_duration: b.actual_duration ?? null,

      qr_code: b.qr_code
        ? {
            qr_image_url: b.qr_code.qr_image_url,
            is_used:      b.qr_code.is_used,
            used_at:      b.qr_code.used_at ? toIST(b.qr_code.used_at) : null,
            scan_window_start: toIST(windows.arrival_window_start),
    scan_window_end:   toIST(windows.scan_window_end),
          }
        : null,

      payment: b.payment
        ? {
            status:        b.payment.status,
            amount:        b.payment.amount,
            paid_at:       b.payment.paid_at    ? toIST(b.payment.paid_at)    : null,
            settled_at:    b.payment.settled_at ? toIST(b.payment.settled_at) : null,
            refund_status: b.payment.refund_status ?? null,
            refund_amount: b.payment.refund_amount ?? null,
          }
        : null,

      review: b.review
        ? {
            id:      b.review.id,
            rating:  b.review.rating,
            comment: b.review.comment ?? null,
          }
        : null,
    };
  }
}
