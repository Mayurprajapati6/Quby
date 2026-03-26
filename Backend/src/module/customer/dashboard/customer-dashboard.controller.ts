import { Response, NextFunction } from "express";
import { CustomerDashboardService } from "./customer-dashboard.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

export class CustomerDashboardController {

  static async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const year  = req.query.year  ? parseInt(req.query.year  as string) : undefined;

      if (month !== undefined && (month < 1 || month > 12)) {
        throw new BadRequestError("month must be between 1 and 12.");
      }
      if (year !== undefined && (year < 2020 || year > 2100)) {
        throw new BadRequestError("year must be a valid year (2020–2100).");
      }

      const data = await CustomerDashboardService.getDashboard(
        req.user!.userId,
        { month, year },
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
