import { prisma } from "../../../config/prisma";

export class AdminVerificationRepository {

  static async findPending(opts: { skip: number; take: number }) {
    const where = { is_verified: false, is_active: true };

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: {
          owner: {
            select: { id: true, name: true, phone: true, user: { select: { email: true } } },
          },
          images:   { select: { id: true, image_url: true, is_primary: true } },
          services: {
            include: { platform_service: { select: { id: true, name: true, category: true } } },
          },
          _count: { select: { staff: true } },
        },
        orderBy: { created_at: "asc" }, 
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.business.count({ where }),
    ]);

    return { businesses, total };
  }

  static async findById(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      include: {
        owner: {
          select: { id: true, name: true, phone: true, user: { select: { id: true, email: true } } },
        },
        images:   { select: { id: true, image_url: true, is_primary: true } },
        services: {
          include: { platform_service: { select: { id: true, name: true, category: true } } },
        },
        schedules: { orderBy: { day_of_week: "asc" } as any },
        staff:     { select: { id: true, name: true, email: true }, where: { is_active: true } },
        _count:    { select: { staff: true } },
      },
    });
  }

  static async approve(businessId: string) {
    return prisma.business.update({
      where: { id: businessId },
      data: {
        is_verified:       true,
        is_active:         true,
        verified_at:       new Date(),
        verification_note: null,
      },
    });
  }

  static async reject(businessId: string, reason: string) {
    return prisma.business.update({
      where: { id: businessId },
      data: {
        is_verified:       false,
        is_active:         false,
        verification_note: reason,
      },
    });
  }

  static async createNotification(
    businessId: string,
    type:       string,
    title:      string,
    message:    string,
    target:     "OWNER" | "BUSINESS" | "BOTH",
  ) {
    return prisma.businessNotification.create({
      data: {
        business_id: businessId,
        type:        type as any,
        title,
        message,
        target,
        expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});
  }
}
