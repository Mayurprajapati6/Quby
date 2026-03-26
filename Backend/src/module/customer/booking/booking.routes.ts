import { Router } from "express";
import { BookingController } from "./booking.controller";
import { validateRequestBody, validateRequestQuery } from "../../../validators";
import {
  suggestStaffSchema,
  checkAvailabilitySchema,
  createBookingSchema,
  cancelBookingSchema,
  myBookingsQuerySchema,
} from "./booking.validator";
import { bookingLimiter } from "../../../middlewares/rateLimiter.middleware";

export const bookingRouter = Router();

bookingRouter.post(
  "/suggest-staff",
  validateRequestBody(suggestStaffSchema),
  BookingController.suggestStaff,
);

bookingRouter.post(
  "/availability",
  validateRequestBody(checkAvailabilitySchema),
  BookingController.checkAvailability,
);

bookingRouter.post(
  "/",
  bookingLimiter,
  validateRequestBody(createBookingSchema),
  BookingController.createBooking,
);

bookingRouter.get(
  "/",
  validateRequestQuery(myBookingsQuerySchema),
  BookingController.getMyBookings,
);

bookingRouter.get("/:id", BookingController.getBookingDetail);

bookingRouter.post(
  "/:id/cancel",
  validateRequestBody(cancelBookingSchema),
  BookingController.cancelBooking,
);
