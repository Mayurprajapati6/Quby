import { Response, NextFunction } from "express";
import { BusinessService } from "./business.service";
import { AuthService } from "../auth/auth.service";
import { successResponse } from "../../utils/helpers/response";
import type { AuthRequest } from "../../middlewares/types";

export class BusinessController {

  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refresh_token ?? req.headers["x-refresh-token"] as string ?? "";
      await AuthService.logout(refreshToken);
      res.json(successResponse(null, "Logged out successfully."));
    } catch (err) { next(err); }
  }

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessService.getProfile(req.user!.businessId!);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const data  = await BusinessService.updateProfile(
        req.user!.businessId!,
        req.body,
        {
          logo:  files?.logo?.[0],
          cover: files?.cover?.[0],
        },
      );
      res.json(successResponse(data, "Profile updated."));
    } catch (err) { next(err); }
  }

  static async getServices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessService.getServices(req.user!.businessId!);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessService.getSchedule(req.user!.businessId!);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getHolidays(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessService.getHolidays(req.user!.businessId!);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}