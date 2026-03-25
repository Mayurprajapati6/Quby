import { Response, NextFunction } from "express";
import { StaffHolidayService } from "./staff-holiday.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

const VALID_TABS = ["upcoming", "running", "completed"] as const;

export class StaffHolidayController {

  static async getHolidays(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tab = (req.query.tab as string) || "upcoming";
      if (!VALID_TABS.includes(tab as any)) {
        throw new BadRequestError("tab must be one of: upcoming, running, completed.");
      }
      const data = await StaffHolidayService.getHolidays(
        req.user!.userId, tab as typeof VALID_TABS[number],
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
