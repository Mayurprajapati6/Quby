import { prisma } from "../../../config/prisma";

export class OwnerReviewsRepository {

  static async find(opts: {
    businessIds:  string[];
    business_id?: string;
    staff_id?:    string;
    rating?:      number;
    page?:        number;
    limit?:       number;
  }) {
    const page  = opts.page  ?? 1;
    const limit = opts.limit ?? 20;

    const where: any = {
      business_id: opts.business_id ?? { in: opts.businessIds },
      is_visible:  true,
    };
    if (opts.staff_id) where.staff_id = opts.staff_id;
    if (opts.rating)   where.rating   = opts.rating;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, avatar_url: true } },
          staff:    { select: { id: true, name: true, avatar_url: true } },
          business: { 
  select: { 
    business_name: true,
    logo_url: true,   // ✅ ADD THIS
  } 
},
          booking:  { select: { id: true, booking_number: true, service_date: true, services: true } },
        },
        orderBy: { created_at: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, total };
  }

  static async findById(reviewId: string, businessIds: string[]) {
    return prisma.review.findFirst({
      where: { id: reviewId, business_id: { in: businessIds }, is_visible: true },
    });
  }

  static async addBusinessResponse(reviewId: string, response: string) {
    return prisma.review.update({
      where: { id: reviewId },
      data:  { business_response: response, business_response_at: new Date() },
    });
  }
}
