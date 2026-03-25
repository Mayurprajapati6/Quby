import { Response, NextFunction } from "express";
import { OwnerHolidayService } from "./owner-holiday.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";
import type { HolidayTab } from "./owner-holiday.types";

const VALID_TABS: HolidayTab[] = ["upcoming", "running", "completed"];

export class OwnerHolidayController {

  static async getHolidays(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tab = (req.query.tab as string) || "upcoming";
      if (!VALID_TABS.includes(tab as HolidayTab)) {
        throw new BadRequestError("tab must be one of: upcoming, running, completed.");
      }
      const data = await OwnerHolidayService.getHolidays(
        req.user!.userId,
        tab as HolidayTab,
        req.params.businessId,  
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async createHoliday(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto  = { ...req.body, business_id: req.params.businessId };
      const data = await OwnerHolidayService.createHoliday(req.user!.userId, dto);
      res.status(201).json(successResponse(data, "Holiday created. Staff have been notified."));
    } catch (err) { next(err); }
  }

  static async updateHoliday(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerHolidayService.updateHoliday(
        req.user!.userId,
        req.params.holidayId,
        req.body,
      );
      res.json(successResponse(data, "Holiday updated. Staff have been notified."));
    } catch (err) { next(err); }
  }

  static async deleteHoliday(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await OwnerHolidayService.deleteHoliday(req.user!.userId, req.params.holidayId);
      res.json(successResponse(null, "Holiday cancelled. Staff have been notified."));
    } catch (err) { next(err); }
  }
}
