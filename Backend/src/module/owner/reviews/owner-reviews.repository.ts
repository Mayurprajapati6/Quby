import { prisma } from "../../../config/prisma";

export class OwnerReviewsRepository {

  static async findBusinessReviews(opts: {
    businessIds:  string[];
    business_id?: string;
    rating?:      number;
    page:         number;
    limit:        number;
  }) {
    const scope = opts.business_id
      ? [opts.business_id].filter(id => opts.businessIds.includes(id))
      : opts.businessIds;

    const where: any = {
      business_id: { in: scope },
      is_visible:  true,
      ...(opts.rating && { business_rating: opts.rating }),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          customer: { select: { name: true, avatar_url: true } },
          staff:    { select: { name: true } },
          business: { select: { business_name: true } },
          booking:  { select: { booking_number: true, service_date: true } },
        },
        orderBy: { created_at: "desc" },
        skip:    (opts.page - 1) * opts.limit,
        take:    opts.limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, total };
  }

  static async findStaffReviews(opts: {
    businessIds:  string[];
    business_id?: string;
    staff_id?:    string;
    rating?:      number;
    page:         number;
    limit:        number;
  }) {
    const scope = opts.business_id
      ? [opts.business_id].filter(id => opts.businessIds.includes(id))
      : opts.businessIds;

    const where: any = {
      business_id: { in: scope },
      is_visible:  true,
      ...(opts.staff_id && { staff_id: opts.staff_id }),
      ...(opts.rating   && { staff_rating: opts.rating }),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          customer: { select: { name: true, avatar_url: true } },
          staff:    { select: { id: true, name: true, avatar_url: true } },
          booking:  { select: { booking_number: true, service_date: true } },
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
      data: {
        business_response:    response,
        business_response_at: new Date(),
      },
    });
  }

  static async findById(reviewId: string, businessIds: string[]) {
    return prisma.review.findFirst({
      where: { id: reviewId, business_id: { in: businessIds } },
    });
  }
}
