import { prisma } from "../../../config/prisma";
import { startOfDay } from "date-fns";

export class StaffBookingsRepository {

  static async find(
    staffId: string,
    opts: {
      status?: string;
      date?:   string;
      skip:    number;
      take:    number;
    },
  ) {
    const today = startOfDay(new Date());

    const where: any = {
      staff_id:   staffId,
      is_visible: { not: false },
      status:     { notIn: ["PENDING_PAYMENT", "EXPIRED"] },
    };

    if (opts.date) {
      const dayStart = startOfDay(new Date(`${opts.date}T00:00:00+05:30`));
      const dayEnd   = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.service_date = { gte: dayStart, lt: dayEnd };
    }

    if (opts.status) {
      switch (opts.status) {
        case "upcoming":
          where.status = "CONFIRMED";
          if (!opts.date) where.service_date = { gt: today };
          break;
        case "running":
          // ALL RUNNING — awaiting check-in + in-progress
          // Frontend distinguishes via service_started_at
          where.status = "RUNNING";
          break;
        case "completed":
          where.status = "COMPLETED";
          break;
        case "cancelled":
          where.status = { in: ["CANCELLED", "REFUND_INITIATED", "REFUNDED"] };
          break;
        case "no_show":
          where.status = "NO_SHOW";
          break;
        case "refund":
          where.status = { in: ["REFUND_INITIATED", "REFUNDED"] };
          break;
        default:
          break;
      }
    }

    // Running: sort awaiting-first (nulls first = service hasn't started), then in-progress
    let orderBy: any = [{ created_at: "desc" }];
    if (opts.status === "running") {
      orderBy = [
        { service_started_at: { sort: "asc", nulls: "first" } },
        { queue_number: "asc" },
      ];
    } else if (opts.status === "upcoming") {
      orderBy = [{ service_start_time: "asc" }, { queue_number: "asc" }];
    } else if (opts.status === "completed" || opts.status === "no_show") {
      orderBy = [{ service_date: "desc" }, { service_start_time: "desc" }];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        select: {
          id:                  true,
          booking_number:      true,
          status:              true,
          service_date:        true,
          service_start_time:  true,
          estimated_duration:  true,
          queue_number:        true,
          service_amount:      true,
          services:            true,
          cancellation_reason: true,
          cancelled_at:        true,
          notes:               true,
          // ✅ ADDED: drives Running sub-state display on staff card + InsightStrip counts
          //   null  → "Awaiting Check-In" (arrival open, QR not yet scanned)
          //   set   → "In Progress" (QR scanned, service running)
          service_started_at:   true,
          service_completed_at: true,
          checked_in_at:        true,
          actual_duration:      true,
          customer: {
            select: { id: true, name: true, avatar_url: true, phone: true },
          },
          payment: {
            select: {
              id:            true,
              status:        true,
              amount:        true,
              refund_status: true,
              refund_amount: true,
              paid_at:       true,
              settled_at:    true,
            },
          },
          review: { select: { id: true, rating: true } },
        },
        orderBy,
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  static async findById(bookingId: string, staffId: string) {
    return prisma.booking.findFirst({
      where: { id: bookingId, staff_id: staffId },
      select: {
        id:                  true,
        booking_number:      true,
        status:              true,
        service_date:        true,
        service_start_time:  true,
        estimated_duration:  true,
        queue_number:        true,
        service_amount:      true,
        services:            true,
        cancellation_reason: true,
        cancelled_at:        true,
        notes:               true,
        service_started_at:   true,
        service_completed_at: true,
        checked_in_at:        true,
        actual_duration:      true,
        customer: {
          select: {
            id: true, name: true, phone: true, avatar_url: true,
            user: { select: { id: true, email: true } },
          },
        },
        qr_code: {
          select: { qr_image_url: true, is_used: true, used_at: true, qr_status: true },
        },
        payment: {
          select: {
            id:            true,
            status:        true,
            amount:        true,
            refund_status: true,
            refund_amount: true,
            paid_at:       true,
            settled_at:    true,
          },
        },
        review: {
          select: { id: true, rating: true, comment: true },
        },
      },
    });
  }
}