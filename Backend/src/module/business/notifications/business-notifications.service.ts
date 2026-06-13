import { BusinessNotificationsRepository } from "./business-notifications.repository";
import { NotFoundError } from "../../../utils/errors/app.error";

export class BusinessNotificationsService {

  static async getNotifications(businessId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const { notifications, total, unreadCount } =
      await BusinessNotificationsRepository.findMany(businessId, "BUSINESS", skip, limit);

    return {
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async markRead(notificationId: string, businessId: string) {
    const notif = await BusinessNotificationsRepository.findOne(notificationId, businessId);
    if (!notif) throw new NotFoundError("Notification not found.");
    return BusinessNotificationsRepository.markRead(notificationId, businessId);
  }

  static async markAllRead(businessId: string) {
    return BusinessNotificationsRepository.markAllRead(businessId, "BUSINESS");
  }
}
