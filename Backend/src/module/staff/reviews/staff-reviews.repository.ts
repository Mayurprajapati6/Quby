import { prisma } from "../../../config/prisma";

export class StaffReviewsRepository {

  // Reviews where this staff member served the customer
  static async find(staffId: string, opts: { rating?: number; skip: number; take: number }) {
    const where: any = { staff_id: staffId, is_visible: true };
    if (opts.rating) where.rating = opts.rating;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, avatar_url: true } },
          booking:  { select: { id: true, booking_number: true, service_date: true, services: true } },
        },
        orderBy: { created_at: "desc" },
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, total };
  }

  static async findById(reviewId: string, staffId: string) {
    return prisma.review.findFirst({
      where: { id: reviewId, staff_id: staffId, is_visible: true },
    });
  }

  // Staff rating summary
  static async getSummary(staffId: string) {
    const [agg, distribution] = await Promise.all([
      prisma.review.aggregate({
        where:  { staff_id: staffId, is_visible: true },
        _avg:   { rating: true },
        _count: { id: true },
      }),
      prisma.review.groupBy({
        by:     ["rating"],
        where:  { staff_id: staffId, is_visible: true },
        _count: { id: true },
        orderBy: { rating: "desc" },
      }),
    ]);

    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const d of distribution) dist[d.rating] = d._count.id;

    return {
      average_rating:      Math.round((agg._avg.rating ?? 0) * 10) / 10,
      total_reviews:       agg._count.id,
      rating_distribution: dist,
    };
  }
}
