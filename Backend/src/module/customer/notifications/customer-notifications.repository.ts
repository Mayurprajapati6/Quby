import { prisma } from "../../../config/prisma";

export class CustomerNotificationsRepository {

  static async findMany(customerId: string, skip: number, take: number) {
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.customerNotification.findMany({
        where:   { customer_id: customerId },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.customerNotification.count({ where: { customer_id: customerId } }),
      prisma.customerNotification.count({ where: { customer_id: customerId, is_read: false } }),
    ]);
    return { notifications, total, unreadCount };
  }

  static async findOne(id: string, customerId: string) {
    return prisma.customerNotification.findFirst({
      where: { id, customer_id: customerId },
    });
  }

  static async markRead(id: string, customerId: string) {
    return prisma.customerNotification.updateMany({
      where: { id, customer_id: customerId },
      data:  { is_read: true, read_at: new Date() },
    });
  }

  static async markAllRead(customerId: string) {
    return prisma.customerNotification.updateMany({
      where: { customer_id: customerId, is_read: false },
      data:  { is_read: true, read_at: new Date() },
    });
  }

  static async deleteExpired() {
    return prisma.customerNotification.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
  }
}
