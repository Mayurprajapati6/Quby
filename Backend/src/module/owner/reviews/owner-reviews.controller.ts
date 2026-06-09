import { Response, NextFunction } from "express";
import { OwnerReviewsService } from "./owner-reviews.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

function pg(req: AuthRequest) {
  return {
    page:  Math.max(1,   parseInt(req.query.page  as string) || 1),
    limit: Math.min(100, parseInt(req.query.limit as string) || 20),
  };
}

export class OwnerReviewsController {

  static async getReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      const data = await OwnerReviewsService.getReviews(req.user!.userId, {
        business_id: req.query.business_id as string | undefined,
        staff_id:    req.query.staff_id    as string | undefined,
        rating,
        ...pg(req),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async respond(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { response } = req.body;
      if (!response?.trim()) throw new BadRequestError("response is required.");
      const data = await OwnerReviewsService.respondToReview(
        req.user!.userId,
        req.params.reviewId,
        response.trim(),
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
