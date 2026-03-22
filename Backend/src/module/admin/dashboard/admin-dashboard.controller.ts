import { Response, NextFunction } from "express";
import { AdminDashboardService } from "./admin-dashboard.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

const VALID_PERIODS = ["week", "month", "year"] as const;

export class AdminDashboardController {

  static async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as string) || "month";
      if (!VALID_PERIODS.includes(period as any)) {
        throw new BadRequestError("period must be one of: week, month, year.");
      }
      const data = await AdminDashboardService.getDashboard(
        period as typeof VALID_PERIODS[number],
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
