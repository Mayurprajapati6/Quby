import { Router } from "express";
import { BusinessReviewsController } from "./business-reviews.controller";
import { validateRequestBody } from "../../../validators";
import { respondToReviewSchema } from "../../../validators/review.validator";

export const businessReviewsRouter = Router();

// GET /business/reviews?staff_id=xxx — all reviews, optionally filtered by staff
businessReviewsRouter.get("/", BusinessReviewsController.getReviews);

// POST /business/reviews/:reviewId/respond — business responds to a review
businessReviewsRouter.post(
  "/:reviewId/respond",
  validateRequestBody(respondToReviewSchema),
  BusinessReviewsController.respond,
);
