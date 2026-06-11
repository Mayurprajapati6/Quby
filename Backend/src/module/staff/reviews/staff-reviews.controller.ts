import { Response, NextFunction } from "express";
import { StaffReviewsService } from "./staff-reviews.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffReviewsController {

  static async getReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw new BadRequestError("rating must be between 1 and 5.");
      }
      const data = await StaffReviewsService.getReviews(req.user!.userId, {
        rating,
        page:  Math.max(1,   parseInt(req.query.page  as string) || 1),
        limit: Math.min(50,  parseInt(req.query.limit as string) || 10),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
