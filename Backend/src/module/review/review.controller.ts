import { Response, NextFunction } from "express";
import { ReviewService } from "./review.service";
import { successResponse } from "../../utils/helpers/response";
import { BadRequestError } from "../../utils/errors/app.error";
import type { AuthRequest } from "../../middlewares/types";

export class ReviewController {

  static async getPending(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReviewService.getPendingReviews(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async submit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { booking_id, rating, comment } = req.body;

      if (!booking_id) throw new BadRequestError("booking_id is required.");
      if (!rating)     throw new BadRequestError("rating is required.");

      const dto = {
        booking_id,
        rating:  parseInt(rating),
        comment: comment || undefined,
      };

      const imageFiles = Array.isArray(req.files)
        ? (req.files as Express.Multer.File[]).slice(0, 3)
        : [];

      const data = await ReviewService.submitReview(req.user!.userId, dto, imageFiles);
      res.status(201).json(successResponse(data, "Review submitted. Thank you!"));
    } catch (err) { next(err); }
  }

  static async getMyReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw new BadRequestError("rating must be between 1 and 5.");
      }
      const data = await ReviewService.getMyReviews(req.user!.userId, {
        rating,
        page:  Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit: Math.min(50, parseInt(req.query.limit as string) || 10),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
