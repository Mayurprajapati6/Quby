import { prisma } from "../../../config/prisma";
import { StaffNotificationsRepository } from "./staff-notifications.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import type {
  StaffNotificationsResponseDTO,
  StaffNotificationDTO,
} from "./staff-notifications.types";

export class StaffNotificationsService {

  private static async resolveStaffId(userId: string): Promise<string> {
    const staff = await prisma.staff.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundError("Staff profile not found.");
    return staff.id;
  }

  static async getNotifications(
    userId: string,
    page  = 1,
    limit = 20
  ): Promise<StaffNotificationsResponseDTO> {
    const staffId = await this.resolveStaffId(userId);
    const skip    = (page - 1) * limit;

    const { notifications, total, unreadCount } =
      await StaffNotificationsRepository.findMany(staffId, skip, limit);

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
    const staffId = await this.resolveStaffId(userId);
    const notif   = await StaffNotificationsRepository.findOne(notificationId, staffId);
    if (!notif) throw new NotFoundError("Notification not found.");
    await StaffNotificationsRepository.markRead(notificationId, staffId);
  }

  static async markAllRead(userId: string): Promise<void> {
    const staffId = await this.resolveStaffId(userId);
    await StaffNotificationsRepository.markAllRead(staffId);
  }
}

function toDTO(n: any): StaffNotificationDTO {
  return {
    id:         n.id,
    type:       n.type,
    title:      n.title,
    message:    n.message,
    data:       n.data       ?? null,
    action_url: n.action_url ?? null,
    is_read:    n.is_read,
    read_at:    n.read_at    ?? null,
    created_at: n.created_at,
  };
}
