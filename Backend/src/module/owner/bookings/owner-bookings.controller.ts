import { Response, NextFunction } from "express";
import { OwnerBookingsService } from "./owner-bookings.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

const VALID_TABS = ["running", "today", "upcoming", "past"] as const;

export class OwnerBookingsController {

  static async getBookings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tab = (req.query.tab as string) || "today";
      if (!VALID_TABS.includes(tab as any)) {
        throw new BadRequestError(`tab must be one of: ${VALID_TABS.join(", ")}.`);
      }

      const data = await OwnerBookingsService.getBookings(req.user!.userId, {
        tab:         tab as typeof VALID_TABS[number],
        business_id: req.query.business_id as string | undefined,
        date:        req.query.date        as string | undefined,
        page:        Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit:       Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getBookingDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerBookingsService.getBookingDetail(
        req.user!.userId, req.params.bookingId,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
