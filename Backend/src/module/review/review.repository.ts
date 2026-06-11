import { prisma } from "../../config/prisma";
import { sub } from "date-fns";

export class ReviewRepository {

  static async findPendingForCustomer(customerId: string) {
    const windowStart = sub(new Date(), { days: 14 });
    return prisma.booking.findMany({
      where: {
        customer_id:  customerId,
        status:       "COMPLETED",
        service_date: { gte: windowStart },
        review:       null,
      },
      include: {
        business: { select: { id: true, business_name: true, logo_url: true } },
        staff:    { select: { id: true, name: true, avatar_url: true } },
      },
      orderBy: { service_date: "desc" },
    });
  }

  static async create(data: {
    booking_id:  string;
    customer_id: string;
    business_id: string;
    staff_id:    string;
    rating:      number;
    comment?:    string | null;
    images:      string[];
  }) {
    return prisma.review.create({
      data: {
        booking_id:  data.booking_id,
        customer_id: data.customer_id,
        business_id: data.business_id,
        staff_id:    data.staff_id,
        rating:      data.rating,
        comment:     data.comment ?? null,
        images:      data.images.length ? data.images : [],
        is_verified: false,
        is_visible:  true,
      },
      include: {
        business: { select: { business_name: true, logo_url: true } },
        staff:    { select: { name: true, avatar_url: true } },
      },
    });
  }

  static async findById(reviewId: string) {
    return prisma.review.findUnique({ where: { id: reviewId } });
  }

  static async findByBookingId(bookingId: string) {
    return prisma.review.findUnique({ where: { booking_id: bookingId } });
  }

  static async findByCustomer(
    customerId: string,
    opts: { rating?: number; page: number; limit: number }
  ) {
    const where: any = {
      customer_id: customerId,
      is_visible:  true,
      ...(opts.rating && { rating: opts.rating }),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
  business: { select: { business_name: true, logo_url: true } },
  staff:    { select: { name: true, avatar_url: true } },
  booking:  { select: { services: true } }, 
},
        orderBy: { created_at: "desc" },
        skip:    (opts.page - 1) * opts.limit,
        take:    opts.limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, total };
  }

  static async addBusinessResponse(reviewId: string, response: string) {
    return prisma.review.update({
      where: { id: reviewId },
      data:  { business_response: response, business_response_at: new Date() },
    });
  }

  static async recalculateStaffRating(staffId: string) {
    const agg = await prisma.review.aggregate({
      where:  { staff_id: staffId, is_visible: true },
      _avg:   { rating: true },
      _count: { id: true },
    });
    return prisma.staff.update({
      where: { id: staffId },
      data: {
        average_rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        total_reviews:  agg._count.id,
      },
    });
  }

  static async recalculateBusinessRating(businessId: string) {
    const agg = await prisma.review.aggregate({
      where:  { business_id: businessId, is_visible: true },
      _avg:   { rating: true },
      _count: { id: true },
    });
    return prisma.business.update({
      where: { id: businessId },
      data: {
        average_rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        total_reviews:  agg._count.id,
      },
    });
  }
}
