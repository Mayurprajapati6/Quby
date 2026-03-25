import { OwnerNotificationsRepository } from "./owner-notifications.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import type {
  OwnerNotificationsResponseDTO,
  OwnerNotificationDTO,
} from "./owner-notifications.types";

export class OwnerNotificationsService {

  static async getNotifications(
    userId: string,
    page  = 1,
    limit = 20
  ): Promise<OwnerNotificationsResponseDTO> {
    const businessIds = await OwnerNotificationsRepository.findBusinessIds(userId);
    const skip = (page - 1) * limit;

    const { notifications, total, unreadCount } =
      await OwnerNotificationsRepository.findMany(businessIds, skip, limit);

    return {
      notifications: notifications.map(toDTO),
      unread_count:  unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async markRead(userId: string, notificationId: string): Promise<void> {
    const businessIds = await OwnerNotificationsRepository.findBusinessIds(userId);
    const notif = await OwnerNotificationsRepository.findOne(notificationId, businessIds);
    if (!notif) throw new NotFoundError("Notification not found.");
    await OwnerNotificationsRepository.markRead(notificationId, businessIds);
  }

  static async markAllRead(userId: string): Promise<void> {
    const businessIds = await OwnerNotificationsRepository.findBusinessIds(userId);
    await OwnerNotificationsRepository.markAllRead(businessIds);
  }
}

function toDTO(n: any): OwnerNotificationDTO {
  return {
    id:            n.id,
    type:          n.type,
    title:         n.title,
    message:       n.message,
    business_id:   n.business_id,
    business_name: n.business?.business_name ?? "",
    data:          n.data       ?? null,
    action_url:    n.action_url ?? null,
    is_read:       n.is_read,
    read_at:       n.read_at    ?? null,
    created_at:    n.created_at,
  };
}
