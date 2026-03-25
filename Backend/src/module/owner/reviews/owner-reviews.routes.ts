import { Router } from "express";
import { OwnerReviewsController } from "./owner-reviews.controller";
import { validateRequestBody } from "../../../validators";
import { respondToReviewSchema } from "../../../validators/review.validator";

export const ownerReviewsRouter = Router();

ownerReviewsRouter.get("/business", OwnerReviewsController.getBusinessReviews);
ownerReviewsRouter.get("/staff", OwnerReviewsController.getStaffReviews);

ownerReviewsRouter.post(
  "/:reviewId/respond",
  validateRequestBody(respondToReviewSchema),
  OwnerReviewsController.respondToReview,
);
