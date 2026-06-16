import { prisma } from "../../../config/prisma";
import { startOfDay, endOfDay } from "date-fns";

export class BusinessBookingsRepository {

  static async findMany(
    businessId: string,
    filters: {
      status?:  string;
      staffId?: string;
      date?:    string;
      skip?:    number;
      take?:    number;
    },
  ) {
    const now = new Date();

    let dateOrStatusFilter: any = {};
    switch (filters.status) {
      case "today":
        dateOrStatusFilter = filters.date
          ? { service_date: new Date(filters.date + "T00:00:00+05:30") }
          : { service_date: { gte: startOfDay(now), lte: endOfDay(now) } };
        break;
      case "upcoming":
        dateOrStatusFilter = {
          service_date: { gt: startOfDay(now) },
          status:       { in: ["CONFIRMED"] },
        };
        break;
      case "past":
        // Updated: NO_SHOW replaces CANCELLED_NO_SHOW
        dateOrStatusFilter = {
          status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
          ...(filters.date && { service_date: new Date(filters.date + "T00:00:00+05:30") }),
        };
        break;
      case "running":
        // Updated: RUNNING replaces IN_PROGRESS/CHECKED_IN dual state
        dateOrStatusFilter = { status: "RUNNING" };
        break;
    }

    const where: any = {
      business_id: businessId,
      status:      { not: "PENDING_PAYMENT" },
      ...dateOrStatusFilter,
      ...(filters.staffId && { staff_id: filters.staffId }),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip:    filters.skip ?? 0,
        take:    filters.take ?? 20,
        orderBy: [{ service_date: "desc" }, { service_start_time: "asc" }],
        include: {
          customer: { select: { id: true, name: true, avatar_url: true, phone: true } },
          staff:    { select: { id: true, name: true, avatar_url: true } },
          business: { select: { id: true, business_name: true, logo_url: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  static async findById(bookingId: string, businessId: string) {
    return prisma.booking.findFirst({
      where:   { id: bookingId, business_id: businessId },
      include: {
        customer: {
          select: {
            id: true, name: true, phone: true, avatar_url: true,
            user: { select: { id: true, email: true } },
          },
        },
        staff:   { select: { id: true, name: true, avatar_url: true } },
        // Use Payment instead of Transaction + Escrow
        payment: {
          select: {
            id:                  true,
            status:              true,
            amount:              true,
            razorpay_payment_id: true,
            paid_at:             true,
            settled_at:          true,
            refund_status:       true,
            refund_amount:       true,
          },
        },
        business: { select: { id: true, business_name: true, logo_url: true } },
        qr_code:  { select: { qr_image_url: true, expires_at: true, is_used: true, used_at: true } },
        review:   { select: { id: true, rating: true, comment: true } },
      },
    });
  }
}
