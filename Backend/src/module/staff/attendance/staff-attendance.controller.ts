import { Response, NextFunction } from "express";
import { z } from "zod";
import { StaffAttendanceService }  from "./staff-attendance.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format (e.g. 2026-01).")
    .optional(),
});

export class StaffAttendanceController {

  static getAttendance = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { month } = monthQuerySchema.parse(req.query);
      const data = await StaffAttendanceService.getMonthlyAttendance(
        req.user!.userId,
        month,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  };
}
