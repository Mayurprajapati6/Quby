import { Response, NextFunction }  from "express";
import { prisma } from "../../config/prisma";
import { successResponse } from "../../utils/helpers/response";
import { NotFoundError } from "../../utils/errors/app.error";
import { uploadImageBuffer, deleteFromCloudinary } from "../../utils/helpers/cloudinary";
import { formatInTimeZone } from "date-fns-tz";
import type { AuthRequest } from "../../middlewares/types";

const IST = "Asia/Kolkata";
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }

import { AuthService } from "../auth/auth.service";
export class AdminController {

  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refresh_token ?? (req.headers["x-refresh-token"] as string) ?? "";
      await AuthService.logout(refreshToken);
      res.json({ success: true, message: "Logged out successfully." });
    } catch (err) { next(err); }
  }

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const admin = await prisma.admin.findUnique({
        where:  { user_id: req.user!.userId },
        include: { user: { select: { email: true, created_at: true } } },
      });
      if (!admin) throw new NotFoundError("Admin profile not found.");

      res.json(successResponse({
        id:           admin.id,
        name:         admin.name,
        email:        admin.user.email,
        avatar_url:   admin.avatar_url   ?? null,
        phone:        admin.phone        ?? null,
        city:         admin.city         ?? null,
        state:        admin.state        ?? null,
        address_line1: admin.address_line1 ?? null,
        is_active:    admin.is_active,
        permissions:  admin.permissions  ?? null,
        joined_at:    toIST(admin.user.created_at),
        last_login_at: admin.last_login_at ? toIST(admin.last_login_at) : null,
      }));
    } catch (err) { next(err); }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const existing = await prisma.admin.findUnique({
        where:  { user_id: req.user!.userId },
        select: { id: true, avatar_url: true },
      });
      if (!existing) throw new NotFoundError("Admin profile not found.");

      const { name, phone, city, state, address_line1 } = req.body;
      const file = req.file as Express.Multer.File | undefined;

      let avatarUrl: string | undefined;
      if (file) {
        if (existing.avatar_url) {
          const m = existing.avatar_url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
          if (m?.[1]) await deleteFromCloudinary(m[1]).catch(() => {});
        }
        const uploaded = await uploadImageBuffer(file, "PROFILES");
        avatarUrl = uploaded.secure_url;
      }

      const payload: Record<string, any> = {};
      if (name          !== undefined) payload.name          = name;
      if (phone         !== undefined) payload.phone         = phone;
      if (city          !== undefined) payload.city          = city;
      if (state         !== undefined) payload.state         = state;
      if (address_line1 !== undefined) payload.address_line1 = address_line1;
      if (avatarUrl)                   payload.avatar_url    = avatarUrl;

      await prisma.admin.update({ where: { id: existing.id }, data: payload });

      res.json(successResponse(null, "Profile updated."));
    } catch (err) { next(err); }
  }
}
