import { Router } from "express";
import { StaffBookingsController } from "./staff-bookings.controller";
import { StaffBookingActionsController } from "./staff-booking-actions.controller";
import { validateRequestBody } from "../../../validators";
import { scanBookingSchema } from "../../../validators/staff-queue.validator";
import { scanLimiter } from "../../../middlewares/rateLimiter.middleware";

export const staffBookingsRouter = Router();

staffBookingsRouter.get("/performance", StaffBookingActionsController.getPerformance);
staffBookingsRouter.get("/", StaffBookingsController.getBookings);

staffBookingsRouter.get("/:bookingId", StaffBookingsController.getBookingDetail);

staffBookingsRouter.post(
  "/:bookingId/scan",
  scanLimiter,
  validateRequestBody(scanBookingSchema),
  StaffBookingActionsController.scanBooking,
);

staffBookingsRouter.post(
  "/:bookingId/complete",
  StaffBookingActionsController.completeBooking,
);
