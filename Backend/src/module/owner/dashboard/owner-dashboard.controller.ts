import { Response, NextFunction } from "express";
import { OwnerDashboardService } from "./owner-dashboard.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

const VALID_PERIODS = ["week", "month", "year"] as const;

export class OwnerDashboardController {

  static async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const data = await OwnerDashboardService.getDashboard(
      req.user!.userId,
      year
    );

    res.json(successResponse(data));
  } catch (err) { next(err); }
}
}
