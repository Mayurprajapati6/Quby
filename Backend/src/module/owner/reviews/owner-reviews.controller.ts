import { Response, NextFunction } from "express";
import { OwnerReviewsService } from "./owner-reviews.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

export class OwnerReviewsController {

  static async getBusinessReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw new BadRequestError("rating must be between 1 and 5.");
      }
      const data = await OwnerReviewsService.getBusinessReviews(req.user!.userId, {
        business_id: req.query.business_id as string | undefined,
        rating,
        page:  Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit: Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getStaffReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw new BadRequestError("rating must be between 1 and 5.");
      }
      const data = await OwnerReviewsService.getStaffReviews(req.user!.userId, {
        business_id: req.query.business_id as string | undefined,
        staff_id:    req.query.staff_id    as string | undefined,
        rating,
        page:  Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit: Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async respondToReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerReviewsService.respondToReview(
        req.user!.userId,
        req.params.reviewId,
        req.body.response,
      );
      res.json(successResponse(data, "Response submitted."));
    } catch (err) { next(err); }
  }
}
