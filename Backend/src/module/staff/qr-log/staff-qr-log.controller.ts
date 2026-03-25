import { Response, NextFunction } from "express";
import { StaffQrLogService } from "./staff-qr-log.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffQrLogController {

  static async getQrLog(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffQrLogService.getQrLog(req.user!.userId, {
        date:  req.query.date  as string | undefined,
        page:  Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit: Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
