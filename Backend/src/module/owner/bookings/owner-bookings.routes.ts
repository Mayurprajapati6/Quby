import { Router } from "express";
import { OwnerBookingsController } from "./owner-bookings.controller";

export const ownerBookingsRouter = Router();

ownerBookingsRouter.get("/", OwnerBookingsController.getBookings);
ownerBookingsRouter.get("/:bookingId",  OwnerBookingsController.getBookingDetail);
