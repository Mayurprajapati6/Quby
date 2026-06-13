import { prisma } from "../../../config/prisma";

export class BusinessReviewsRepository {

  // All reviews for a business — filter by staff_id to get "staff-specific" view
  static async find(
    businessId: string,
    opts: {
      rating?:   number;
      staff_id?: string;  // filter to show only reviews for a specific staff member
      skip:      number;
      take:      number;
    },
  ) {
    const where: any = { business_id: businessId, is_visible: true };
    if (opts.rating)   where.rating   = opts.rating;
    if (opts.staff_id) where.staff_id = opts.staff_id;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, avatar_url: true } },
          staff:    { select: { id: true, name: true, avatar_url: true } },
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

  static async findById(reviewId: string, businessId: string) {
    return prisma.review.findFirst({
      where: { id: reviewId, business_id: businessId, is_visible: true },
    });
  }

  static async addResponse(reviewId: string, response: string) {
    return prisma.review.update({
      where: { id: reviewId },
      data:  { business_response: response, business_response_at: new Date() },
    });
  }

  // Rating summary + per-staff breakdown
  static async getSummary(businessId: string) {
    const [agg, distribution, staffBreakdown] = await Promise.all([
      prisma.review.aggregate({
        where:  { business_id: businessId, is_visible: true },
        _avg:   { rating: true },
        _count: { id: true },
      }),
      prisma.review.groupBy({
        by:      ["rating"],
        where:   { business_id: businessId, is_visible: true },
        _count:  { id: true },
        orderBy: { rating: "desc" },
      }),
      // Per-staff average — lets the business see how each staff member is rated
      prisma.review.groupBy({
        by:      ["staff_id"],
        where:   { business_id: businessId, is_visible: true },
        _avg:    { rating: true },
        _count:  { id: true },
        orderBy: { _avg: { rating: "desc" } },
      }),
    ]);

    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const d of distribution) dist[d.rating] = d._count.id;

    // Enrich staff breakdown with names
    const staffIds   = staffBreakdown.map(s => s.staff_id);
    const staffNames = staffIds.length
      ? await prisma.staff.findMany({
          where:  { id: { in: staffIds } },
          select: { id: true, name: true, avatar_url: true },
        })
      : [];
    const staffMap = new Map(staffNames.map(s => [s.id, s]));

    return {
      average_rating:      Math.round((agg._avg.rating ?? 0) * 10) / 10,
      total_reviews:       agg._count.id,
      rating_distribution: dist,
      staff_breakdown: staffBreakdown.map(s => ({
        staff_id:       s.staff_id,
        staff_name:     staffMap.get(s.staff_id)?.name       ?? "",
        staff_avatar:   staffMap.get(s.staff_id)?.avatar_url ?? null,
        average_rating: Math.round((s._avg.rating ?? 0) * 10) / 10,
        total_reviews:  s._count.id,
      })),
    };
  }
}
