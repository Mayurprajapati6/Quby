import { Response, NextFunction } from "express";
import { StaffService } from "./staff.service";
import { successResponse } from "../../utils/helpers/response";
import { BadRequestError } from "../../utils/errors/app.error";
import type { AuthRequest } from "../../middlewares/types";

import { AuthService } from "../auth/auth.service";
export class StaffController {

  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refresh_token ?? (req.headers["x-refresh-token"] as string) ?? "";
      await AuthService.logout(refreshToken);
      res.json({ success: true, message: "Logged out successfully." });
    } catch (err) { next(err); }
  }

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffService.getProfile(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file as Express.Multer.File | undefined;
      const data = await StaffService.updateProfile(req.user!.userId, req.body, file);
      res.json(successResponse(data, "Profile updated."));
    } catch (err) { next(err); }
  }

  static async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { password } = req.body;
      if (!password) throw new BadRequestError("password is required.");
      await StaffService.deleteAccount(req.user!.userId, password);
      res.json(successResponse(null, "Account deleted."));
    } catch (err) { next(err); }
  }
}
