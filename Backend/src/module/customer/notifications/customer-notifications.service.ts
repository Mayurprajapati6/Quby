import { prisma } from "../../../config/prisma";
import { CustomerNotificationsRepository } from "./customer-notifications.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import type {
  CustomerNotificationsResponseDTO,
  CustomerNotificationDTO,
} from "./customer-notifications.types";

export class CustomerNotificationsService {

  static async getNotifications(
    userId: string,
    page  = 1,
    limit = 20
  ): Promise<CustomerNotificationsResponseDTO> {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    const skip = (page - 1) * limit;
    const { notifications, total, unreadCount } =
      await CustomerNotificationsRepository.findMany(customer.id, skip, limit);

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
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    const notif = await CustomerNotificationsRepository.findOne(notificationId, customer.id);
    if (!notif) throw new NotFoundError("Notification not found.");

    await CustomerNotificationsRepository.markRead(notificationId, customer.id);
  }

  static async markAllRead(userId: string): Promise<void> {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    await CustomerNotificationsRepository.markAllRead(customer.id);
  }
}

function toDTO(n: any): CustomerNotificationDTO {
  return {
    id:         n.id,
    type:       n.type,
    title:      n.title,
    message:    n.message,
    is_read:    n.is_read,
    read_at:    n.read_at   ?? null,
    created_at: n.created_at,
    data:       n.data      ?? null,
  };
}
