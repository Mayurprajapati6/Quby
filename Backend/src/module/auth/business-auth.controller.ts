import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../middlewares/types";
import { BusinessAuthService } from "./business-auth.service";
import { successResponse } from "../../utils/helpers/response";

export class BusinessAuthController {

  static async getAccountInfo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessAuthService.getAccountInfo(
        req.user!.userId,
        req.params.businessId
      );
      if (!data) {
        return res.json(successResponse(null, "No saloon PC account exists for this business."));
      }
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async createAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessAuthService.createAccount(
        req.user!.userId,
        req.params.businessId,
        req.body
      );
      res.status(201).json(
        successResponse(data, "Saloon PC login account created successfully.")
      );
    } catch (err) { next(err); }
  }

  static async resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessAuthService.resetPassword(
        req.user!.userId,
        req.params.businessId,
        req.body
      );
      res.json(successResponse(null, "Password updated. All active sessions have been revoked."));
    } catch (err) { next(err); }
  }

  static async setAccountStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { is_active } = req.body;
      await BusinessAuthService.setAccountStatus(
        req.user!.userId,
        req.params.businessId,
        Boolean(is_active)
      );
      const msg = is_active ? "Account activated." : "Account deactivated. All sessions revoked.";
      res.json(successResponse(null, msg));
    } catch (err) { next(err); }
  }

  static async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessAuthService.deleteAccount(
        req.user!.userId,
        req.params.businessId
      );
      res.json(successResponse(null, "Saloon PC account permanently deleted."));
    } catch (err) { next(err); }
  }
}
