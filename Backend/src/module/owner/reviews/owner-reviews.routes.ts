import { Router } from "express";
import { OwnerReviewsController } from "./owner-reviews.controller";
import { validateRequestBody } from "../../../validators";
import { respondToReviewSchema } from "../../../validators/review.validator";

export const ownerReviewsRouter = Router();

ownerReviewsRouter.get("/", OwnerReviewsController.getReviews);

ownerReviewsRouter.post(
  "/:reviewId/respond",
  validateRequestBody(respondToReviewSchema),
  OwnerReviewsController.respond,
);
