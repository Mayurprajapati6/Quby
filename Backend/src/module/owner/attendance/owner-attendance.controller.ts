import { Response, NextFunction }  from "express";
import { z } from "zod";
import { OwnerAttendanceService }  from "./owner-attendance.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD.").optional(),
});

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM.").optional(),
});

export class OwnerAttendanceController {

  static getDailyAttendance = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { date }       = dateQuerySchema.parse(req.query);
      const { businessId } = req.query as { businessId?: string };
      if (!businessId) {
        res.status(400).json({ success: false, message: "businessId is required." });
        return;
      }
      const data = await OwnerAttendanceService.getDailyAttendance(
        req.user!.userId,
        businessId,
        date,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  };

  static getStaffAttendance = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { month } = monthQuerySchema.parse(req.query);
      const data = await OwnerAttendanceService.getStaffAttendance(
        req.user!.userId,
        req.params.id,
        month,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  };
}
