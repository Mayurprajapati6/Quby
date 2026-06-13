import { Response, NextFunction } from "express";
import { BusinessDashboardService } from "./business-dashboard.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

const VALID_PERIODS = ["week", "month", "year"] as const;

export class BusinessDashboardController {

  static async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as string) || "month";
      if (!VALID_PERIODS.includes(period as any)) {
        throw new BadRequestError("period must be one of: week, month, year.");
      }
      // ✅ FIX: pass ownerUserId so service can verify ownership
      const data = await BusinessDashboardService.getDashboard(
        req.user!.businessId!,
        period as typeof VALID_PERIODS[number],
        req.user!.userId,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
