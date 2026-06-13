import { Response, NextFunction } from "express";
import { BusinessReviewsService } from "./business-reviews.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

function getBusinessId(req: AuthRequest): string {
  const id = (req as any).businessId || req.query.businessId || req.params.businessId;
  if (!id) throw new BadRequestError("businessId is required.");
  return id as string;
}

export class BusinessReviewsController {

  static async getReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      const data = await BusinessReviewsService.getReviews(getBusinessId(req), {
        rating,
        staff_id: req.query.staff_id as string | undefined,
        page:  Math.max(1,   parseInt(req.query.page  as string) || 1),
        limit: Math.min(100, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async respond(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { response } = req.body;
      if (!response?.trim()) throw new BadRequestError("response is required.");
      const data = await BusinessReviewsService.respondToReview(
        req.params.reviewId,
        getBusinessId(req),
        response.trim(),
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
