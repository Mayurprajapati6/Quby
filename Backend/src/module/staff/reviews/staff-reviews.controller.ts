import { Response, NextFunction }  from "express";
import { StaffReviewsService } from "./staff-reviews.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffReviewsController {

  static async getReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      if (rating !== undefined && (isNaN(rating) || rating < 1 || rating > 5)) {
        throw new BadRequestError("rating must be 1–5.");
      }
      const data = await StaffReviewsService.getReviews(req.user!.userId, {
        rating,
        page:  Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit: Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async respondToReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { response } = req.body;
      if (!response?.trim()) throw new BadRequestError("response is required.");
      const data = await StaffReviewsService.respondToReview(
        req.user!.userId, req.params.reviewId, response.trim(),
      );
      res.json(successResponse(data, "Response published."));
    } catch (err) { next(err); }
  }
}
