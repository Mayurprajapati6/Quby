import { Response, NextFunction } from "express";
import { OwnerService } from "./owner.service";
import { successResponse } from "../../utils/helpers/response";
import type { AuthRequest } from "../../middlewares/types";

export class OwnerController {

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerService.getProfile(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerService.updateProfile(
        req.user!.userId,
        req.body,
        req.file,
      );
      res.json(successResponse(data, "Profile updated successfully."));
    } catch (err) { next(err); }
  }

  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerService.getNotifications(req.user!.userId, {
        unread: req.query.unread === "true",
        page:   Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit:  Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async markNotificationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerService.markNotificationRead(req.user!.userId, req.params.id);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async markAllNotificationsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerService.markAllNotificationsRead(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = req.body.refresh_token ?? req.cookies?.refresh_token;
      const data  = await OwnerService.logout(token);
      res.clearCookie("refresh_token");
      res.json(successResponse(data, "Logged out successfully."));
    } catch (err) { next(err); }
  }
}
