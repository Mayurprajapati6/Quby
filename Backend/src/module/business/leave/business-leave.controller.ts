import { Response, NextFunction } from "express";
import { BusinessLeaveService } from "./business-leave.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

const VALID_HOLIDAY_TABS = ["upcoming", "running", "completed"] as const;

export class BusinessLeaveController {

  static async getHolidays(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tab = (req.query.tab as string) || "upcoming";
      if (!VALID_HOLIDAY_TABS.includes(tab as any)) {
        throw new BadRequestError("tab must be one of: upcoming, running, completed.");
      }
      const data = await BusinessLeaveService.getHolidays(
        req.user!.businessId!,
        tab as typeof VALID_HOLIDAY_TABS[number],
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getLeaves(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessLeaveService.getLeaves(
        req.user!.businessId!,
        req.query.status as string | undefined,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
