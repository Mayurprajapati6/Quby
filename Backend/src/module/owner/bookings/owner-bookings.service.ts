import { prisma } from "../../../config/prisma";
import { OwnerBookingsRepository } from "./owner-bookings.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
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

/**
 * Derive all time windows from service_start_time (single source of truth).
 * Never use stored arrival_window_start/end or service_end_time directly.
 */
function deriveWindows(serviceStart: Date, estimatedDuration: number) {
 return {
  arrival_window_start: deriveArrivalWindowStart(serviceStart),

  arrival_window_end: deriveArrivalWindowEnd(serviceStart),

  scan_window_end: deriveScanWindowEnd(serviceStart),

  service_end_time: deriveServiceEnd(serviceStart, estimatedDuration),
};
}

export class OwnerBookingsService {

  private static async getBusinessIds(userId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    return businesses.map(b => b.id);
  }

  static async getBookings(
    userId: string,
    opts: {
      tab: "running" | "today" | "upcoming" | "completed" | "no_show" | "refund";
      business_id?: string;
      date?: string;
      page: number;
      limit: number;
    },
  ) {
    const businessIds = await this.getBusinessIds(userId);

    const { bookings, total } = await OwnerBookingsRepository.find({
      businessIds,
      ...opts,
    });

    let finalBookings = bookings;

    if (opts.tab === "refund") {
      finalBookings = bookings.sort((a: any, b: any) => {
        const order: Record<string, number> = { REFUND_INITIATED: 0, REFUNDED: 1 };
        const aOrder = order[a.status] ?? 2;
        const bOrder = order[b.status] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return {
      bookings: finalBookings.map(b => {
        const bk    = b as any;
        const rawStart = new Date(b.service_start_time);
        const start = bookingWindowStart(rawStart);
        const windows = deriveWindows(rawStart, b.estimated_duration);

        return {
          id:             b.id,
          booking_number: b.booking_number,
          // ✅ Business with logo
          business_name: bk.business?.business_name ?? "",
          business_logo: bk.business?.logo_url      ?? null,
          // ✅ Customer
          customer_name:   bk.customer?.name       ?? "",
          customer_phone:  bk.customer?.phone       ?? null,
          customer_avatar: bk.customer?.avatar_url  ?? null,
          // ✅ Staff
          staff_name:   bk.staff?.name       ?? "",
          staff_avatar: bk.staff?.avatar_url  ?? null,
          // ✅ Schedule
          service_date:         toISTDate(b.service_date),
          service_start_time:   toIST(start),
          arrival_window_start: toIST(windows.arrival_window_start),

          arrival_window_end: toIST(
  windows.arrival_window_end
),

scan_window_end: toIST(
  windows.scan_window_end
),

service_end_time: toIST(
  windows.service_end_time
),
service_started_at: bk.service_started_at
            ? toIST(new Date(bk.service_started_at)) : null,
          // ✅ actual times for timeline
          actual_start_time: bk.service_started_at
            ? toIST(new Date(bk.service_started_at))
            : null,
          actual_end_time: bk.service_completed_at
            ? toIST(new Date(bk.service_completed_at))
            : null,
          checked_in_at: bk.checked_in_at
            ? toIST(new Date(bk.checked_in_at))
            : null,
          estimated_duration: b.estimated_duration,
          actual_duration:    bk.actual_duration ?? null,
          queue_number:       b.queue_number,
          // ✅ Services as full objects with image_url — NOT plain strings
          services: Array.isArray(b.services)
            ? (b.services as any[]).map(s => ({
                name:             s.name             ?? "",
                duration_minutes: s.duration_minutes ?? null,
                price:            s.price            ?? null,   
                image_url:        s.image_url        ?? null,
              }))
            : [],
          status:         b.status,
          
          service_amount: b.service_amount,
          payment: bk.payment ? {
            status:        bk.payment.status,
            
            amount:        bk.payment.amount,
            refund_status: bk.payment.refund_status,
            refund_amount: bk.payment.refund_amount ?? null,
          } : null,
          // ✅ review for star display on completed cards
          has_review: !!(bk.review),
          review_rating: bk.review?.rating ?? null,
          // ✅ cancellation info
          cancellation_reason: b.cancellation_reason ?? null,
          cancelled_at: bk.cancelled_at ? toIST(new Date(bk.cancelled_at)) : null,
          cancellable_until:   bk.cancellable_until ? toIST(new Date(bk.cancellable_until)) : null,
        };
      }),
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getBookingDetail(userId: string, bookingId: string) {
    const businessIds = await this.getBusinessIds(userId);
    const booking     = await OwnerBookingsRepository.findById(bookingId, businessIds);
    if (!booking) throw new NotFoundError("Booking not found.");

    const b      = booking as any;
    const rawStart = new Date(booking.service_start_time);
    const start  = bookingWindowStart(rawStart);
    const windows = deriveWindows(rawStart, booking.estimated_duration);

    return {
      id:                   booking.id,
      booking_number:       booking.booking_number,
      // ✅ Business with logo
      business_name: booking.business.business_name,
      business_logo: (booking.business as any).logo_url ?? null,
      // ✅ Customer
      customer: {
        id:         booking.customer.id,
        name:       booking.customer.name,
        phone:      booking.customer.phone      ?? null,
        avatar_url: booking.customer.avatar_url ?? null,
      },
      // ✅ Staff
      staff: {
        id:         booking.staff.id,
        name:       booking.staff.name,
        phone:      b.staff.phone      ?? null,
        avatar_url: booking.staff.avatar_url ?? null,
      },
      // ✅ Schedule — derived windows
      service_date:         toISTDate(booking.service_date),
      service_start_time:   toIST(start),
      arrival_window_start: toIST(
  windows.arrival_window_start
),

arrival_window_end: toIST(
  windows.arrival_window_end
),

scan_window_end: toIST(
  windows.scan_window_end
),

service_end_time: toIST(
  windows.service_end_time
),
      estimated_duration:   booking.estimated_duration,
      queue_number:         booking.queue_number,
      // ✅ Services with image_url for thumbnail display in modal
      services: Array.isArray(b.services)
        ? (b.services as any[]).map((s: any) => ({
            name:             s.name             ?? "",
            duration_minutes: s.duration_minutes ?? 0,
            price:            s.price            ?? null,   
            image_url:        s.image_url        ?? null,
          }))
        : [],
      
      status:              booking.status,
      service_amount:      b.service_amount,
      cancellation_reason: booking.cancellation_reason ?? null,
      cancelled_at:        booking.cancelled_at ? toIST(booking.cancelled_at) : null,
      qr_image_url:        b.qr_code?.qr_image_url ?? null,
      
      payment: b.payment ? {
        id:                  b.payment.id,
        status:              b.payment.status,
        amount:              b.payment.amount,              
        paid_at:             b.payment.paid_at    ? toIST(new Date(b.payment.paid_at))    : null,
        settled_at:          b.payment.settled_at ? toIST(new Date(b.payment.settled_at)) : null,
        refund_status:       b.payment.refund_status ?? null,
        refund_amount:       b.payment.refund_amount ?? null, 
        refund_id:           b.payment.refund_id ?? null,
        razorpay_payment_id: b.payment.razorpay_payment_id ?? null,
        razorpay_order_id:   b.payment.razorpay_order_id   ?? null,
      } : null,
      // ✅ Full timeline fields
      service_started_at: booking.service_started_at ? toIST(booking.service_started_at)   : null,
      checked_in_at:    booking.checked_in_at        ? toIST(booking.checked_in_at)        : null,
      actual_start_time: booking.service_started_at  ? toIST(booking.service_started_at)   : null,
      actual_end_time:   booking.service_completed_at ? toIST(booking.service_completed_at) : null,
      actual_duration:   booking.actual_duration      ?? null,
      cancellable_until: (booking as any).cancellable_until ? toIST(new Date((booking as any).cancellable_until)) : null,
      cancelled_by:      (booking as any).cancelled_by ?? null,
      // ✅ Review
      review: b.review ? {
        id:      b.review.id,
        rating:  b.review.rating,
        comment: b.review.comment ?? null,
      } : null,
    };
  }
}
