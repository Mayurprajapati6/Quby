import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middlewares/types";
import { StaffNotificationsService } from "./staff-notifications.service";
import { successResponse } from "../../../utils/helpers/response";

export class StaffNotificationsController {

  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffNotificationsService.getNotifications(
        req.user!.userId,
        req.query.page  ? Number(req.query.page)  : 1,
        req.query.limit ? Number(req.query.limit) : 20
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await StaffNotificationsService.markAllRead(req.user!.userId);
      res.json(successResponse(null, "All notifications marked as read."));
    } catch (err) { next(err); }
  }

  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await StaffNotificationsService.markRead(req.user!.userId, req.params.id);
      res.json(successResponse(null, "Notification marked as read."));
    } catch (err) { next(err); }
  }
}
