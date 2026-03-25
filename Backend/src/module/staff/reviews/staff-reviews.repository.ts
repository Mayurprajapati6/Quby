import { prisma } from "../../../config/prisma";

export class StaffReviewsRepository {

  static async find(staffId: string, opts: { rating?: number; skip: number; take: number }) {
    const where: any = { staff_id: staffId, is_visible: true };
    if (opts.rating) where.staff_rating = opts.rating;

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

  static async addResponse(reviewId: string, response: string) {
    return prisma.review.update({
      where: { id: reviewId },
      data:  { staff_response: response, staff_response_at: new Date() },
    });
  }
}
