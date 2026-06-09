import { Response, NextFunction } from "express";
import { BookingService } from "./booking.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class BookingController {

  static async suggestStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { business_id, service_offering_ids, service_date } = req.body;

    const data = await BookingService.suggestStaff(
      business_id,
      service_offering_ids,
      new Date(service_date)
    );

    res.json(successResponse(data));
  } catch (err) {
    next(err);
  }
}

  static async checkAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.checkAvailability(req.user!.userId, req.body);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async createBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.createBooking(req.user!.userId, req.body);
      const code = data.is_idempotent ? 200 : 201;
      res.status(code).json(
        successResponse(data, "Booking created. Complete payment within 10 minutes.")
      );
    } catch (err) { next(err); }
  }

  static async getMyBookings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.getMyBookings(req.user!.userId, {
        tab:   (req.query.tab   as string) || "upcoming",
        page:  Math.max(1, parseInt(req.query.page  as string) || 1),
        limit: Math.min(50, parseInt(req.query.limit as string) || 10),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getBookingDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.getBookingDetail(req.params.id, req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
  
  static async cancelBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.cancelBooking(
        req.params.id,
        req.user!.userId,
        req.body,
      );
      res.json(successResponse(data, "Booking cancelled successfully."));
    } catch (err) { next(err); }
  }

  static async voidPendingBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BookingService.voidPendingBooking(
        req.params.id,
        req.user!.userId,
      );
      res.json(successResponse(data, "Booking voided."));
    } catch (err) { next(err); }
  }
}
