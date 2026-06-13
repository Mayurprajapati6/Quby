import { Response, NextFunction } from "express";
import { BusinessNotificationsService } from "./business-notifications.service";
import { successResponse } from "../../../utils/helpers/response";
import { AuthRequest } from "../../../middlewares/types";

export class BusinessNotificationsController {

  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page  = req.query.page  ? parseInt(req.query.page  as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const data  = await BusinessNotificationsService.getNotifications(
        req.user!.businessId!,
        page,
        limit
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessNotificationsService.markRead(
        req.params.id,
        req.user!.businessId!
      );
      res.json(successResponse(null, "Notification marked as read."));
    } catch (err) { next(err); }
  }

  static async markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessNotificationsService.markAllRead(req.user!.businessId!);
      res.json(successResponse(null, "All notifications marked as read."));
    } catch (err) { next(err); }
  }
}
