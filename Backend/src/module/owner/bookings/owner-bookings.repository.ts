import { prisma } from "../../../config/prisma";
import { startOfDay } from "date-fns";

export class OwnerBookingsRepository {

  static async find(opts: {
    businessIds: string[];
    business_id?: string;
    tab:         "running" | "today" | "upcoming" | "past";
    date?:       string;     
    page:        number;
    limit:       number;
  }) {
    const scope = opts.business_id
      ? [opts.business_id].filter(id => opts.businessIds.includes(id))
      : opts.businessIds;

    const now   = new Date();
    const today = startOfDay(now);

    let where: any = { business_id: { in: scope } };

    if (opts.tab === "running") {
      where.status = { in: ["CHECKED_IN", "IN_PROGRESS"] };
    } else if (opts.tab === "today") {
      where.service_date = opts.date
        ? new Date(opts.date + "T00:00:00+05:30")
        : today;
      where.status = { notIn: ["PENDING_PAYMENT"] };
    } else if (opts.tab === "upcoming") {
      where.service_date = { gt: today };
      where.status       = { in: ["CONFIRMED"] };
    } else {
      // past
      where.service_date = opts.date
        ? new Date(opts.date + "T00:00:00+05:30")
        : { lt: today };
      where.status = { in: ["COMPLETED", "CANCELLED", "CANCELLED_TIMEOUT", "CANCELLED_NO_SHOW"] };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, avatar_url: true } },
          staff:    { select: { id: true, name: true, avatar_url: true } },
          business: { select: { id: true, business_name: true } },
        },
        orderBy: opts.tab === "running" || opts.tab === "today"
          ? [{ service_start_time: "asc" }]
          : opts.tab === "upcoming"
            ? [{ service_date: "asc" }, { service_start_time: "asc" }]
            : [{ service_date: "desc" }],
        skip:  (opts.page - 1) * opts.limit,
        take:  opts.limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  static async findById(bookingId: string, businessIds: string[]) {
    return prisma.booking.findFirst({
      where: { id: bookingId, business_id: { in: businessIds } },
      include: {
        customer: { select: { id: true, name: true, phone: true, avatar_url: true } },
        staff:    { select: { id: true, name: true, avatar_url: true, phone: true } },
        business: { select: { id: true, business_name: true } },
        qr_code:            { select: { qr_image_url: true } },
        escrow: { select: { id: true, status: true, amount: true, scheduled_release_at: true, released_at: true } },
        review:             { select: { id: true, overall_rating: true } },
      },
    });
  }
}