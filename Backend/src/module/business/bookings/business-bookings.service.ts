import { prisma } from "../../../config/prisma";
import { BusinessBookingsRepository } from "./business-bookings.repository";
import { emitToUser } from "../../../socket/socket.service";
import { queueEmail } from "../../../services/email.services";
import { NotFoundError, BadRequestError } from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import { formatInTimeZone } from "date-fns-tz";
import { addMinutes } from "date-fns";
import { invalidateSlotCache } from "../../../utils/cache/slotCache";
import { bookingQueue, settleQueue, notificationQueue, refundQueue, analyticsQueue } from "../../../config/bullmq";
import {
  bookingWindowStart,
  deriveArrivalWindowEnd,
  deriveArrivalWindowStart,
  deriveScanWindowEnd,
  deriveServiceEnd,
} from "../../../utils/helpers/timeWindows";

const TZ = "Asia/Kolkata";
function toTZ(d: Date)     { return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toTZDate(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM-dd"); }

function serviceNames(b: any): string[] {
  return Array.isArray(b.services) ? b.services.map((s: any) => s.name ?? "") : [];
}

/**
 * toListItem — maps a DB booking to the owner list/card shape.
 *
 * ✅ services: full objects { name, image_url, price, duration_minutes }
 *    so BookingCard can render service image + name + price
 * ✅ service_started_at exposed for Running sub-state display
 * ✅ business_name + business_logo for card header
 */
function toListItem(b: any) {
  const rawStart     = new Date(b.service_start_time);
  const start        = bookingWindowStart(rawStart);
  const arrivalStart = deriveArrivalWindowStart(rawStart);
  const scanEnd      = deriveScanWindowEnd(rawStart);
  const serviceEnd   = deriveServiceEnd(rawStart, b.estimated_duration);

  return {
    id:                   b.id,
    booking_number:       b.booking_number,
    status:               b.status,
    service_date:         toTZDate(b.service_date),
    service_start_time:   toTZ(start),
    arrival_window_start: toTZ(arrivalStart),
    arrival_window_end:   toTZ(start),
    scan_window_end:      toTZ(scanEnd),
    service_end_time:     toTZ(serviceEnd),
    estimated_duration:   b.estimated_duration,
    queue_number:         b.queue_number,
    service_amount:       b.service_amount,
    // ✅ Full service objects — name + image_url + price
    services: Array.isArray(b.services)
      ? b.services.map((s: any) => ({
          name:             s.name             ?? "",
          duration_minutes: s.duration_minutes ?? null,
          image_url:        s.image_url        ?? null,
          price:            s.price            ?? null,
        }))
      : [],
    customer: {
      id:         b.customer.id,
      name:       b.customer.name,
      phone:      b.customer.phone      ?? null,
      avatar_url: b.customer.avatar_url ?? null,
    },
    staff: { id: b.staff.id, name: b.staff.name, avatar_url: b.staff.avatar_url ?? null },
    // ✅ Business info for card header
    business_name: b.business?.business_name ?? null,
    business_logo: b.business?.logo_url      ?? null,
    // ✅ Running sub-state
    service_started_at: b.service_started_at ? toTZ(b.service_started_at) : null,
    actual_start_time:  b.service_started_at ? toTZ(b.service_started_at) : null,
    actual_end_time:    b.service_completed_at ? toTZ(b.service_completed_at) : null,
    actual_duration:    b.actual_duration ?? null,
    has_review:         !!(b.review),
  };
}

export class BusinessBookingsService {

  static async getBookings(
    businessId: string,
    opts: {
      status?:   string;
      staff_id?: string;
      date?:     string;
      page:      number;
      limit:     number;
    },
  ) {
    const { bookings, total } = await BusinessBookingsRepository.findMany(businessId, {
      status:  opts.status,
      staffId: opts.staff_id,
      date:    opts.date,
      skip:    (opts.page - 1) * opts.limit,
      take:    opts.limit,
    });

    return {
      bookings: bookings.map(toListItem),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async getBookingDetail(bookingId: string, businessId: string) {
    const b = await BusinessBookingsRepository.findById(bookingId, businessId);
    if (!b) throw new NotFoundError("Booking not found.");

    return {
      ...toListItem(b),
      notes:               b.notes               ?? null,
      cancellation_reason: b.cancellation_reason  ?? null,
      cancelled_at:        b.cancelled_at          ? toTZ(b.cancelled_at) : null,
      cancelled_by:        b.cancelled_by          ?? null,
      service_started_at:  b.service_started_at    ? toTZ(b.service_started_at)   : null,
      actual_start_time:   b.service_started_at    ? toTZ(b.service_started_at)   : null,
      service_completed_at: b.service_completed_at ? toTZ(b.service_completed_at) : null,
      actual_end_time:     b.service_completed_at  ? toTZ(b.service_completed_at) : null,
      actual_duration:     b.actual_duration        ?? null,
      scan_window_end:     toTZ(deriveScanWindowEnd(new Date(b.service_start_time))),
      service_end_time:    toTZ(deriveServiceEnd(new Date(b.service_start_time), b.estimated_duration)),
      business_name: (b as any).business?.business_name ?? null,
      business_logo: (b as any).business?.logo_url      ?? null,
      payment: (b as any).payment ? {
        id:                  (b as any).payment.id,
        status:              (b as any).payment.status,
        amount:              (b as any).payment.amount,
        razorpay_payment_id: (b as any).payment.razorpay_payment_id ?? null,
        paid_at:             (b as any).payment.paid_at    ? toTZ((b as any).payment.paid_at)    : null,
        settled_at:          (b as any).payment.settled_at ? toTZ((b as any).payment.settled_at) : null,
        refund_status:       (b as any).payment.refund_status  ?? null,
        refund_amount:       (b as any).payment.refund_amount  ?? null,
      } : null,
      review: (b as any).review ? {
        id:      (b as any).review.id,
        rating:  (b as any).review.rating,
        comment: (b as any).review.comment ?? null,
      } : null,
      has_review: !!(b as any).review,
    };
  }

  static async cancelBooking(bookingId: string, businessId: string): Promise<void> {
    const booking = await BusinessBookingsRepository.findById(bookingId, businessId);
    if (!booking) throw new NotFoundError("Booking not found.");

    if (![ "CONFIRMED", "CHECKED_IN"].includes(booking.status)) {
      throw new BadRequestError(`Cannot cancel a booking with status: ${booking.status}.`);
    }

    const now     = new Date();
    const payment = (booking as any).payment;

    // ── Atomic booking update ──────────────────────────────────
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data:  {
          status:              "CANCELLED",
          cancelled_at:        now,
          cancelled_by:        "business" as any,
          cancellation_reason: "Cancelled by business.",
        },
      });

      await tx.qRCode.updateMany({
        where: { booking_id: bookingId, qr_status: "ACTIVE" },
        data:  { expires_at: now, qr_status: "CANCELLED", is_used: true },
      });

      // Update payment to REFUNDED state
      if (payment?.status === "PAID") {
        await tx.payment.update({
          where: { booking_id: bookingId },
          data:  {
            status:        "REFUNDED",
            refund_amount: payment.amount,
            refund_status: "PROCESSING",
            refund_reason: "Cancelled by business",
          },
        });
      }
    });

    // ── Enqueue Razorpay refund with retries ───────────────────
    if (payment?.razorpay_payment_id && payment?.status === "PAID") {
      await refundQueue.add(
        `refund:${bookingId}`,
        {
          bookingId,
          paymentId: payment.razorpay_payment_id,
          amount:    payment.amount,
          reason:    "Cancelled by business",
        },
        { jobId: `refund:${bookingId}`, attempts: 5 },
      ).catch(err => logger.error(`[BusinessBookings] Refund queue failed for ${bookingId}:`, err));
    }

    // ── Cancel scheduled jobs ──────────────────────────────────
    await Promise.allSettled([
      bookingQueue.getJob(`no-show:${bookingId}`).then(j => j?.remove()).catch(() => {}),
      settleQueue.getJob(`settle:${bookingId}`).then(j => j?.remove()).catch(() => {}),
      notificationQueue.getJob(`reminder-1hr:${bookingId}`).then(j => j?.remove()).catch(() => {}),
      notificationQueue.getJob(`reminder-15min:${bookingId}`).then(j => j?.remove()).catch(() => {}),
    ]);

    // ── Customer notification + email ──────────────────────────
    const customerUser = (booking as any).customer?.user;
    if (customerUser?.id) {
      emitToUser(customerUser.id, "booking:cancelled", { bookingId, booking_number: booking.booking_number });

      const wasPaid = !!payment?.razorpay_payment_id;
      queueEmail({
        to:   customerUser.email,
        type: "booking-cancelled",
        data: {
          customerName:  (booking as any).customer.name,
          businessName:  (booking as any).business?.business_name ?? "",
          bookingNumber: booking.booking_number,
          serviceName:   serviceNames(booking).join(", "),
          serviceDate:   booking.service_date.toISOString().slice(0, 10),
          reason:        "Cancelled by business.",
          refundAmount:  wasPaid ? (payment.amount ?? 0) : 0,
        },
      }).catch(() => {});

      if (wasPaid) {
        queueEmail({
          to:   customerUser.email,
          type: "refund-confirmation",
          data: {
            customerName:  (booking as any).customer.name,
            businessName:  (booking as any).business?.business_name ?? "",
            bookingNumber: booking.booking_number,
            refundAmount:  payment.amount ?? 0,
          },
        }).catch(() => {});
      }
    }

    invalidateSlotCache(booking.staff_id, booking.service_date.toISOString().slice(0, 10)).catch(() => {});

    analyticsQueue.add(
      `booking-cancelled:${bookingId}`,
      { type: "booking-cancelled", bookingId, businessId: booking.business_id },
      { jobId: `analytics:booking-cancelled:${bookingId}` },
    ).catch(() => {});
  }
}
