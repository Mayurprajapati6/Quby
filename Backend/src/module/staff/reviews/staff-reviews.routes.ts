import { Router } from "express";
import { StaffReviewsController } from "./staff-reviews.controller";

export const staffReviewsRouter = Router();

// GET /staff/reviews — reviews where this staff member served
staffReviewsRouter.get("/", StaffReviewsController.getReviews);
