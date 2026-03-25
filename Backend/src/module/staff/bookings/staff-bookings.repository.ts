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
    const where: any = {
      staff_id: staffId,
      status:   { not: "PENDING_PAYMENT" },
    };

    if (opts.date) {
      where.service_date = startOfDay(new Date(`${opts.date}T00:00:00+05:30`));
    }

    if (opts.status) {
      switch (opts.status) {
        case "upcoming":
          where.status = { in: ["CONFIRMED"] };
          where.service_date = { gte: startOfDay(new Date()) };
          break;
        case "running":
          where.status = { in: ["CHECKED_IN", "IN_PROGRESS"] };
          break;
        case "completed":
          where.status = "COMPLETED";
          break;
        case "cancelled":
          where.status = { in: ["CANCELLED", "CANCELLED_TIMEOUT", "CANCELLED_NO_SHOW"] };
          break;
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, avatar_url: true, phone: true } },
          review:   { select: { id: true, overall_rating: true } },
        },
        orderBy: [{ service_date: "desc" }, { queue_number: "asc" }],
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  static async findById(bookingId: string, staffId: string) {
    return prisma.booking.findFirst({
      where:   { id: bookingId, staff_id: staffId },
      include: {
        customer: {
          select: {
            id: true, name: true, phone: true, avatar_url: true,
            user: { select: { id: true, email: true } },
          },
        },
        transaction: {
          select: { status: true, amount: true, razorpay_payment_id: true, paid_at: true },
        },
        qr_code: {
          select: { qr_image_url: true, is_used: true, used_at: true, expires_at: true },
        },
        escrow: {
          select: { id: true, status: true, amount: true, scheduled_release_at: true, released_at: true },
        },
        review: {
          select: {
            id: true, overall_rating: true, staff_rating: true,
            staff_comment: true, staff_response: true, staff_response_at: true,
          },
        },
      },
    });
  }
}