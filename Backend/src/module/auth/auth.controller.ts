import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { successResponse } from "../../utils/helpers/response";
import type { AuthRequest } from "../../middlewares/types";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  changePasswordSchema,
  staffSetupSchema,
  deleteAccountSchema,
} from "./auth.validator";

export class AuthController {

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const dto    = registerSchema.parse(req.body);
      const result = await AuthService.signup(dto);
      res.status(201).json(successResponse(result, "Account created successfully."));
    } catch (err) { next(err); }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const dto    = loginSchema.parse(req.body);
      const meta   = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
      const result = await AuthService.login(dto, meta);
      res.json(successResponse(result));
    } catch (err) { next(err); }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = refreshTokenSchema.parse(req.body);
      const meta   = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
      const tokens = await AuthService.refreshAccessToken(refresh_token, meta);
      res.json(successResponse(tokens));
    } catch (err) { next(err); }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body;
      if (refresh_token) await AuthService.logout(refresh_token);
      res.json(successResponse(null, "Logged out successfully."));
    } catch (err) { next(err); }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await AuthService.forgotPassword({ email });
      res.json(successResponse(null, "If that email is registered, a reset link has been sent."));
    } catch (err) { next(err); }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = resetPasswordSchema.parse(req.body);
      await AuthService.resetPassword(dto);
      res.json(successResponse(null, "Password reset successfully. Please log in."));
    } catch (err) { next(err); }
  }

  static async staffSetup(req: Request, res: Response, next: NextFunction) {
    try {
      const dto    = staffSetupSchema.parse(req.body);
      const meta   = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
      const result = await AuthService.staffSetup(dto, meta);
      res.json(successResponse(result, "Account setup complete. Welcome!"));
    } catch (err) { next(err); }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto = changePasswordSchema.parse(req.body);
      await AuthService.changePassword(req.user!.userId, dto);
      res.json(successResponse(null, "Password changed successfully."));
    } catch (err) { next(err); }
  }

  static async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { password } = deleteAccountSchema.parse(req.body);
      await AuthService.deleteAccount(req.user!.userId, password);
      res.json(successResponse(null, "Account deleted successfully."));
    } catch (err) { next(err); }
  }
}
