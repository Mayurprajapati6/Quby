import { Router } from "express";
import { BusinessBookingsController } from "./business-bookings.controller";
import { validateRequestQuery } from "../../../validators";
import { businessBookingsQuerySchema } from "../../../validators/business.validator";

export const businessBookingsRouter = Router();

businessBookingsRouter.get(
  "/",
  validateRequestQuery(businessBookingsQuerySchema),
  BusinessBookingsController.getBookings,
);

businessBookingsRouter.get("/:bookingId", BusinessBookingsController.getBookingDetail);

businessBookingsRouter.post("/:bookingId/cancel", BusinessBookingsController.cancelBooking);
