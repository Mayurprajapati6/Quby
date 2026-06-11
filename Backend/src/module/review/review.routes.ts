import { Router } from "express";
import { ReviewController } from "./review.controller";
import { uploadMultiple, handleMulterError } from "../../utils/helpers/multer";
import { reviewLimiter }  from "../../middlewares/rateLimiter.middleware";
import { validateRequestBody, validateRequestQuery } from "../../validators";
import {
  submitReviewSchema,
  myReviewsQuerySchema,
} from "../../validators/review.validator";

export const reviewRouter = Router();

reviewRouter.get("/pending", ReviewController.getPending);

reviewRouter.get(
  "/",
  validateRequestQuery(myReviewsQuerySchema),
  ReviewController.getMyReviews,
);

reviewRouter.post(
  "/",
  reviewLimiter,
  uploadMultiple,
  handleMulterError,
  validateRequestBody(submitReviewSchema),
  ReviewController.submit,
);
