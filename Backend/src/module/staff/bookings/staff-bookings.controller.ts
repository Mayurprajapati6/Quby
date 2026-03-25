import { Response, NextFunction }  from "express";
import { StaffBookingsService } from "./staff-bookings.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffBookingsController {

  static async getBookings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffBookingsService.getBookings(req.user!.userId, {
        status: req.query.status as string | undefined,
        date:   req.query.date   as string | undefined,
        page:   Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit:  Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getBookingDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffBookingsService.getBookingDetail(
        req.user!.userId, req.params.bookingId,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
