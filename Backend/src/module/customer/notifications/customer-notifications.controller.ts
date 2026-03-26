import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middlewares/types";
import { CustomerNotificationsService } from "./customer-notifications.service";
import { successResponse } from "../../../utils/helpers/response";

export class CustomerNotificationsController {

  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page  = req.query.page  ? Number(req.query.page)  : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const data  = await CustomerNotificationsService.getNotifications(
        req.user!.userId,
        page,
        limit
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CustomerNotificationsService.markRead(req.user!.userId, req.params.id);
      res.json(successResponse(null, "Notification marked as read."));
    } catch (err) { next(err); }
  }

  static async markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CustomerNotificationsService.markAllRead(req.user!.userId);
      res.json(successResponse(null, "All notifications marked as read."));
    } catch (err) { next(err); }
  }
}
