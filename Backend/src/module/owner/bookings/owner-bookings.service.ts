import { prisma } from "../../../config/prisma";
import { OwnerBookingsRepository } from "./owner-bookings.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toIST(d: Date)     { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

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
      tab:          "running" | "today" | "upcoming" | "past";
      business_id?: string;
      date?:        string;
      page:         number;
      limit:        number;
    },
  ) {
    const businessIds = await this.getBusinessIds(userId);

    const { bookings, total } = await OwnerBookingsRepository.find({
      businessIds,
      ...opts,
    });

    return {
      bookings: bookings.map(b => ({
        id:             b.id,
        booking_number: b.booking_number,
        business_name:  b.business.business_name,
        customer_name:  b.customer.name,
        customer_phone: b.customer.phone    ?? null,
        customer_avatar: b.customer.avatar_url ?? null,
        staff_name:     b.staff.name,
        staff_avatar:   b.staff.avatar_url  ?? null,
        service_date:   toISTDate(b.service_date),
        service_start_time: toIST(b.service_start_time),
        services:       Array.isArray(b.services) ? (b.services as any[]).map(s => s.name ?? "") : [],
        status:         b.status,
        service_amount: (b as any).service_amount,
        platform_fee:   (b as any).platform_fee      ?? 0,
        total_amount:   (b as any).total_amount,
      })),
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

    return {
      id:                   booking.id,
      booking_number:       booking.booking_number,
      business_name:        booking.business.business_name,
      customer: {
        id:         booking.customer.id,
        name:       booking.customer.name,
        phone:      booking.customer.phone      ?? null,
        avatar_url: booking.customer.avatar_url ?? null,
      },
      staff: {
        id:         booking.staff.id,
        name:       booking.staff.name,
        phone:      (booking.staff as any).phone ?? null,
        avatar_url: booking.staff.avatar_url     ?? null,
      },
      service_date:         toISTDate(booking.service_date),
      service_start_time:       toIST(booking.service_start_time),
      arrival_window_start: toIST(booking.arrival_window_start),
      arrival_window_end:   toIST(booking.arrival_window_end),
      service_end_time:     toIST(booking.service_end_time),
      services:             Array.isArray((booking as any).services)
        ? (booking as any).services.map((s: any) => ({
            name:             s.name ?? "",
            duration_minutes: s.duration_minutes ?? 0,
          }))
        : [],
      status:               booking.status,
      service_amount:       (booking as any).service_amount,
      platform_fee:         booking.platform_fee      ?? 0,
      total_amount:         (booking as any).total_amount,
      cancellation_reason:  booking.cancellation_reason ?? null,
      qr_image_url:         (booking as any).qr_code?.qr_image_url ?? null,
      escrow: booking.escrow ? {
            id:                (booking.escrow as any).id,
            status:            (booking.escrow as any).status,
            amount_inr:        (booking.escrow as any).amount / 100,
            escrow_release_at: (booking.escrow as any).scheduled_release_at ? toIST(new Date((booking.escrow as any).scheduled_release_at)) : null,
            released_at:       (booking.escrow as any).released_at           ? toIST(new Date((booking.escrow as any).released_at))          : null,
          }
        : null,
      has_review: !!(booking as any).review,
    };
  }
}