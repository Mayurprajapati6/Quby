import { Response, NextFunction } from "express";
import { StaffDetailService } from "./staff-detail.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffDetailController {

  static async getStaffDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as string) || "month";
      if (!["week", "month", "year"].includes(period)) {
        throw new BadRequestError("period must be one of: week, month, year.");
      }

      const data = await StaffDetailService.getStaffDetail(
        req.user!.userId,
        req.params.staffId,
        period as "week" | "month" | "year",
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
