import { Response, NextFunction } from "express";
import { AdminVerificationService } from "./admin-verification.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

export class AdminVerificationController {

  static async getPending(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminVerificationService.getPendingBusinesses({
        page:  Math.max(1,   parseInt(req.query.page  as string) || 1),
        limit: Math.min(100, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getBusinessForReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminVerificationService.getBusinessForReview(req.params.businessId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async approve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminVerificationService.approveVerification(req.params.businessId);
      res.json(successResponse(data, "Business approved."));
    } catch (err) { next(err); }
  }

  static async reject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      if (!reason?.trim()) throw new BadRequestError("reason is required for rejection.");
      const data = await AdminVerificationService.rejectVerification(
        req.params.businessId, reason.trim(),
      );
      res.json(successResponse(data, "Business rejected."));
    } catch (err) { next(err); }
  }
}
