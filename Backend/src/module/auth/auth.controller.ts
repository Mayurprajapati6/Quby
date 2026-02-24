import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AuthService } from "./auth.service";
import { successResponse } from "../../utils/helpers/response";
import { AUTH_MESSAGES } from "../../constants/messages";
import { AuthRequest } from "../../middlewares/types";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function extractMeta(req: Request) {
  return {
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip,
    userAgent: req.headers["user-agent"],
  };
}

export class AuthController {

  static signup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await AuthService.signup(req.body);

      res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

      res.status(StatusCodes.CREATED).json(
        successResponse(
          { accessToken: result.accessToken, user: result.user },
          AUTH_MESSAGES.REGISTRATION_SUCCESS
        )
      );
    } catch (err) {
      next(err);
    }
  };

  static login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await AuthService.login(req.body, extractMeta(req));

      res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

      res.status(StatusCodes.OK).json(
        successResponse(
          { accessToken: result.accessToken, user: result.user },
          AUTH_MESSAGES.LOGIN_SUCCESS
        )
      );
    } catch (err) {
      next(err);
    }
  };

  static staffSetup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await AuthService.staffSetup(req.body, extractMeta(req));

      res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

      res.status(StatusCodes.CREATED).json(
        successResponse(
          { accessToken: result.accessToken, user: result.user },
          "Account setup successful. Welcome aboard!"
        )
      );
    } catch (err) {
      next(err);
    }
  };

  static forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await AuthService.forgotPassword(req.body);

      res.status(StatusCodes.OK).json(
        successResponse(
          null,
          "If an account with this email exists, you will receive a password reset link shortly."
        )
      );
    } catch (err) {
      next(err);
    }
  };

  static resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await AuthService.resetPassword(req.body);

      res.status(StatusCodes.OK).json(
        successResponse(
          null,
          "Password reset successfully. Please login with your new password."
        )
      );
    } catch (err) {
      next(err);
    }
  };

  static changePassword = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await AuthService.changePassword(req.user!.userId, req.body);

      res.clearCookie("refreshToken");

      res.status(StatusCodes.OK).json(
        successResponse(
          null,
          "Password changed successfully. Please login again on all devices."
        )
      );
    } catch (err) {
      next(err);
    }
  };

  static refresh = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: AUTH_MESSAGES.UNAUTHORIZED,
        });
        return;
      }

      const result = await AuthService.refreshAccessToken(
        refreshToken,
        extractMeta(req)
      );

      res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

      res.status(StatusCodes.OK).json(
        successResponse({ accessToken: result.accessToken })
      );
    } catch (err) {
      next(err);
    }
  };

  static logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }

      res.clearCookie("refreshToken");

      res.status(StatusCodes.OK).json(
        successResponse(null, AUTH_MESSAGES.LOGOUT_SUCCESS)
      );
    } catch (err) {
      next(err);
    }
  };

  static logoutAll = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await AuthService.logoutAllDevices(req.user!.userId);

      res.clearCookie("refreshToken");

      res.status(StatusCodes.OK).json(
        successResponse(null, "Logged out from all devices successfully.")
      );
    } catch (err) {
      next(err);
    }
  };

  static deleteAccount = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await AuthService.deleteAccount(req.user!.userId, req.body.password);

      res.clearCookie("refreshToken");

      res.status(StatusCodes.OK).json(
        successResponse(null, "Account permanently deleted.")
      );
    } catch (err) {
      next(err);
    }
  };
}