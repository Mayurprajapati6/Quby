import { prisma } from "../../../config/prisma";

export class BusinessNotificationsRepository {

  static async findMany(
    businessId: string,
    target:     "BUSINESS" | "OWNER" | "BOTH",
    skip:       number,
    take:       number
  ) {
    
    const targets = target === "BOTH"
      ? ["BOTH"]
      : [target, "BOTH"];

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.businessNotification.findMany({
        where:   { business_id: businessId, target: { in: targets } },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.businessNotification.count({
        where: { business_id: businessId, target: { in: targets } },
      }),
      prisma.businessNotification.count({
        where: { business_id: businessId, target: { in: targets }, is_read: false },
      }),
    ]);

    return { notifications, total, unreadCount };
  }

  static async findOne(id: string, businessId: string) {
    return prisma.businessNotification.findFirst({
      where: { id, business_id: businessId },
    });
  }

  static async markRead(id: string, businessId: string) {
    return prisma.businessNotification.updateMany({
      where: { id, business_id: businessId },
      data:  { is_read: true, read_at: new Date() },
    });
  }

  static async markAllRead(businessId: string, target: "BUSINESS" | "OWNER") {
    const targets = [target, "BOTH"];
    return prisma.businessNotification.updateMany({
      where: { business_id: businessId, target: { in: targets }, is_read: false },
      data:  { is_read: true, read_at: new Date() },
    });
  }

  static async deleteExpired() {
    return prisma.businessNotification.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
  }
}
