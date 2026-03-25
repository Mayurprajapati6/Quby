import { prisma } from "../../../config/prisma";

export class OwnerNotificationsRepository {

  static async findBusinessIds(userId: string): Promise<string[]> {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) return [];

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    return businesses.map((b) => b.id);
  }

  static async findMany(
    businessIds: string[],
    skip:        number,
    take:        number
  ) {
    if (!businessIds.length) return { notifications: [], total: 0, unreadCount: 0 };

    const where = {
      business_id: { in: businessIds },
      target:      { in: ["OWNER", "BOTH"] },
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.businessNotification.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take,
        include: { business: { select: { business_name: true } } },
      }),
      prisma.businessNotification.count({ where }),
      prisma.businessNotification.count({
        where: { ...where, is_read: false },
      }),
    ]);

    return { notifications, total, unreadCount };
  }

  static async findOne(id: string, businessIds: string[]) {
    return prisma.businessNotification.findFirst({
      where: {
        id,
        business_id: { in: businessIds },
        target:      { in: ["OWNER", "BOTH"] },
      },
    });
  }

  static async markRead(id: string, businessIds: string[]) {
    return prisma.businessNotification.updateMany({
      where: { id, business_id: { in: businessIds } },
      data:  { is_read: true, read_at: new Date() },
    });
  }

  static async markAllRead(businessIds: string[]) {
    if (!businessIds.length) return;
    return prisma.businessNotification.updateMany({
      where: {
        business_id: { in: businessIds },
        target:      { in: ["OWNER", "BOTH"] },
        is_read:     false,
      },
      data: { is_read: true, read_at: new Date() },
    });
  }
}
