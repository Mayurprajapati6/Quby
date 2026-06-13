import { Response, NextFunction } from "express";
import { BusinessBookingsService } from "./business-bookings.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

const VALID_STATUSES = ["running", "today", "upcoming", "past"] as const;

export class BusinessBookingsController {

  static async getBookings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as string | undefined;
      if (status && !VALID_STATUSES.includes(status as any)) {
        throw new BadRequestError(`status must be one of: ${VALID_STATUSES.join(", ")}.`);
      }
      const data = await BusinessBookingsService.getBookings(req.user!.businessId!, {
        status,
        staff_id: req.query.staff_id as string | undefined,
        date:     req.query.date     as string | undefined,
        page:     Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit:    Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getBookingDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessBookingsService.getBookingDetail(
        req.params.bookingId, req.user!.businessId!,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async cancelBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessBookingsService.cancelBooking(
        req.params.bookingId, req.user!.businessId!,
      );
      res.json(successResponse(null, "Booking cancelled and customer notified."));
    } catch (err) { next(err); }
  }
}
