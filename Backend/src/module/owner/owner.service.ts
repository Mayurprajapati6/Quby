import { prisma } from "../../config/prisma";
import { OwnerRepository } from "./owner.repository";
import { AuthRepository } from "../../module/auth/auth.repository";
import { uploadImageBuffer } from "../../utils/helpers/cloudinary";

import {
  ConflictError,
  NotFoundError,
  BadRequestError
} from "../../utils/errors/app.error";
import { toOwnerProfile } from "./owner.mapper";

import type { UpdateOwnerProfileDTO, OwnerProfile } from "./owner.types";

export class OwnerService {

  static async getProfile(userId: string): Promise<OwnerProfile> {
    const owner = await OwnerRepository.findByUserId(userId);
    if (!owner) throw new NotFoundError("Owner profile not found.");
    return toOwnerProfile(owner);
  }

  static async updateProfile(
    userId:      string,
    data:        UpdateOwnerProfileDTO,
    avatarFile?: Express.Multer.File,
  ): Promise<OwnerProfile> {
    const owner = await OwnerRepository.findByUserId(userId);
    if (!owner) throw new NotFoundError("Owner profile not found.");

    if (data.phone) {
      const existing = await OwnerRepository.findByPhone(data.phone);
      if (existing && existing.id !== owner.id) {
        throw new ConflictError("This phone number is already linked to another account.");
      }
    }

    let avatar_url: string | undefined;
    if (avatarFile) {
      const uploaded = await uploadImageBuffer(avatarFile, "PROFILES");
      avatar_url     = uploaded.secure_url;
    }

    const updated = await OwnerRepository.updateProfile(owner.id, {
      name:          data.name,
      phone:         data.phone,
      city:          data.city,
      state:         data.state,
      address_line1: data.address_line1,
      address_line2: data.address_line2,
      avatar_url,
    });

    return toOwnerProfile(updated);
  }

  static async getNotifications(
    userId: string,
    opts:   { unread?: boolean; page: number; limit: number }
  ) {
    const owner = await OwnerRepository.findByUserId(userId);
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    const businessIds = businesses.map(b => b.id);

    const where: any = {
      business_id: { in: businessIds },
      target:      { in: ["OWNER", "BOTH"] },
      ...(opts.unread && { is_read: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.businessNotification.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip:    (opts.page - 1) * opts.limit,
        take:    opts.limit,
      }),
      prisma.businessNotification.count({ where }),
      prisma.businessNotification.count({
        where: {
          business_id: { in: businessIds },
          target:      { in: ["OWNER", "BOTH"] },
          is_read:     false,
        },
      }),
    ]);

    return {
      notifications,
      unread_count: unreadCount,
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async markNotificationRead(userId: string, notificationId: string) {
    const owner = await OwnerRepository.findByUserId(userId);
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const notification = await prisma.businessNotification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundError("Notification not found.");

    const owned = await prisma.business.findFirst({
      where: { id: notification.business_id, owner_id: owner.id },
    });
    if (!owned) throw new NotFoundError("Notification not found.");

    await prisma.businessNotification.update({
      where: { id: notificationId },
      data:  { is_read: true },
    });
    return { marked: true };
  }

  static async markAllNotificationsRead(userId: string) {
    const owner = await OwnerRepository.findByUserId(userId);
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    const businessIds = businesses.map(b => b.id);

    await prisma.businessNotification.updateMany({
      where: {
        business_id: { in: businessIds },
        target:      { in: ["OWNER", "BOTH"] },
        is_read:     false,
      },
      data: { is_read: true },
    });
    return { marked: true };
  }

  static async logout(refreshToken: string) {
    if (!refreshToken) throw new BadRequestError("Refresh token is required.");
    await AuthRepository.revokeRefreshToken(refreshToken);
    return { logged_out: true };
  }
}
