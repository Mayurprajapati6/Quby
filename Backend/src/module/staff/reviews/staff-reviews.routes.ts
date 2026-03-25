import { Router } from "express";
import { StaffReviewsController } from "./staff-reviews.controller";
import { validateRequestBody } from "../../../validators";
import { respondToReviewSchema } from "../../../validators/review.validator";

export const staffReviewsRouter = Router();

staffReviewsRouter.get("/", StaffReviewsController.getReviews);

staffReviewsRouter.post(
  "/:reviewId/respond",
  validateRequestBody(respondToReviewSchema),
  StaffReviewsController.respondToReview,
);
