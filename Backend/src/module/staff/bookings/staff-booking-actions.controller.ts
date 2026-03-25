import { Response, NextFunction } from "express";
import { StaffBookingActionsService } from "./staff-booking-actions.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffBookingActionsController {

  static async scanBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { bookingId } = req.params;
      const { qr_id, scan_method } = req.body;

      if (!bookingId?.trim()) throw new BadRequestError("bookingId is required.");
      if (!qr_id?.trim())     throw new BadRequestError("qr_id is required.");

      const data = await StaffBookingActionsService.scanBooking(
        req.user!.userId,
        bookingId.trim(),
        qr_id.trim(),
        scan_method ?? "CAMERA",
      );

      res.json(successResponse(data, "Check-in successful."));
    } catch (err) { next(err); }
  }

  static async completeBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { bookingId } = req.params;
      if (!bookingId?.trim()) throw new BadRequestError("bookingId is required.");

      const data = await StaffBookingActionsService.completeBooking(
        req.user!.userId,
        bookingId.trim(),
      );

      res.json(successResponse(data, "Service completed."));
    } catch (err) { next(err); }
  }

  static async getPerformance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as string) ?? "month";
      if (!["week", "month", "year"].includes(period)) {
        throw new BadRequestError("period must be week, month, or year.");
      }
      const data = await StaffBookingActionsService.getPerformanceSummary(
        req.user!.userId,
        period as "week" | "month" | "year",
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
