import { prisma } from "../../../config/prisma";
import { StaffBookingsRepository } from "./staff-bookings.repository";
import { NotFoundError, ForbiddenError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toIST(d: Date)     { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

function svcNames(b: any): string[] {
  return Array.isArray(b.services) ? b.services.map((s: any) => s.name ?? "") : [];
}

async function resolveStaff(userId: string) {
  const staff = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, is_active: true },
  });
  if (!staff)           throw new NotFoundError("Staff profile not found.");
  if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");
  return staff;
}

function toListItem(b: any) {
  return {
    id:             b.id,
    booking_number: b.booking_number,
    status:         b.status,
    service_date:   toISTDate(b.service_date),
    queue_number:   b.queue_number,
    service_start_time: toIST(b.arrival_window_start),
    estimated_duration: b.estimated_duration,
    services:       svcNames(b),
    service_amount: b.service_amount,
    total_amount:   b.total_amount,
    customer: {
      id:         b.customer.id,
      name:       b.customer.name,
      phone:      b.customer.phone      ?? null,
      avatar_url: b.customer.avatar_url ?? null,
    },
    has_review: !!(b as any).review,
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

    return {
      bookings: bookings.map(toListItem),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async getBookingDetail(userId: string, bookingId: string) {
    const staff   = await resolveStaff(userId);
    const booking = await StaffBookingsRepository.findById(bookingId, staff.id);
    if (!booking) throw new NotFoundError("Booking not found.");

    const b = booking as any;

    return {
      ...toListItem(b),
      notes:               b.notes               ?? null,
      cancellation_reason: b.cancellation_reason  ?? null,
      arrival_window_start: toIST(b.arrival_window_start),
      arrival_window_end:   toIST(b.arrival_window_end),
      service_start_time:   toIST(b.service_start_time),
      service_end_time:     toIST(b.service_end_time),
      checked_in_at:       b.checked_in_at       ? toIST(b.checked_in_at)       : null,
      service_started_at:  b.service_started_at  ? toIST(b.service_started_at)  : null,
      completed_at:        b.service_completed_at ? toIST(b.service_completed_at) : null,
      cancelled_at:        b.cancelled_at         ? toIST(b.cancelled_at)        : null,
      actual_duration:     b.actual_duration      ?? null,
      escrow: b.escrow ? {
        id:                  b.escrow.id,
        status:              b.escrow.status,
        amount_inr:          b.escrow.amount / 100,
        escrow_release_at:   b.escrow.scheduled_release_at ? toIST(b.escrow.scheduled_release_at) : null,
        released_at:         b.escrow.released_at          ? toIST(b.escrow.released_at)          : null,
      } : null,
      qr_code: b.qr_code
        ? {
            qr_image_url: b.qr_code.qr_image_url,
            is_used:      b.qr_code.is_used,
            used_at:      b.qr_code.used_at ? toIST(b.qr_code.used_at) : null,
            expires_at:   toIST(b.qr_code.expires_at),
          }
        : null,
      transaction: b.transaction
        ? {
            status:              b.transaction.status,
            amount:              b.transaction.amount,
            razorpay_payment_id: b.transaction.razorpay_payment_id ?? null,
            paid_at:             b.transaction.paid_at ? toIST(b.transaction.paid_at) : null,
          }
        : null,
      review: b.review
        ? {
            id:                b.review.id,
            overall_rating:    b.review.overall_rating,
            staff_rating:      b.review.staff_rating,
            staff_comment:     b.review.staff_comment     ?? null,
            staff_response:    b.review.staff_response    ?? null,
            staff_response_at: b.review.staff_response_at
              ? toIST(b.review.staff_response_at) : null,
          }
        : null,
    };
  }
}