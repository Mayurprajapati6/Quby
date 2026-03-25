import { prisma } from "../../../config/prisma";

export class StaffNotificationsRepository {

  static async findMany(staffId: string, skip: number, take: number) {
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.staffNotification.findMany({
        where:   { staff_id: staffId },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.staffNotification.count({ where: { staff_id: staffId } }),
      prisma.staffNotification.count({ where: { staff_id: staffId, is_read: false } }),
    ]);
    return { notifications, total, unreadCount };
  }

  static async findOne(id: string, staffId: string) {
    return prisma.staffNotification.findFirst({
      where: { id, staff_id: staffId },
    });
  }

  static async markRead(id: string, staffId: string) {
    return prisma.staffNotification.updateMany({
      where: { id, staff_id: staffId },
      data:  { is_read: true, read_at: new Date() },
    });
  }

  static async markAllRead(staffId: string) {
    return prisma.staffNotification.updateMany({
      where: { staff_id: staffId, is_read: false },
      data:  { is_read: true, read_at: new Date() },
    });
  }

  static async deleteExpired() {
    return prisma.staffNotification.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
  }
}
