import { NextFunction, Response } from "express";
import { verifyAccessToken } from "../utils/helpers/jwt";
import { UnauthorizedError, ForbiddenError } from "../utils/errors/app.error";
import { AuthRequest } from "./types";
import { prisma } from "../config/prisma";
import { JwtPayload } from "../module/auth/auth.types";

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next(new UnauthorizedError("Authorization token missing."));
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { version: true, is_active: true, role: true },
    });

    if (!user) {
      return next(new UnauthorizedError("Account not found."));
    }

    if (user.version !== payload.version) {
      return next(new UnauthorizedError("Session expired. Please login again."));
    }

    if (user.role === "STAFF") {
      if (!user.is_active) {
        return next(
          new UnauthorizedError(
            "You are no longer associated with a business. Please contact your employer."
          )
        );
      }

      const staff = await prisma.staff.findUnique({
        where: { user_id: payload.userId },
        select: { is_active: true },
      });

      if (!staff || !staff.is_active) {
        return next(
          new UnauthorizedError(
            "You are no longer associated with a business. Please contact your employer."
          )
        );
      }
    } else if (user.role === "ADMIN") {
      const admin = await prisma.admin.findUnique({
        where: { user_id: payload.userId },
        select: { is_active: true },
      });

      if (!admin || !admin.is_active) {
        return next(
          new UnauthorizedError(
            "Your account has been deactivated. Please contact support."
          )
        );
      }
    } else {
      if (!user.is_active) {
        return next(
          new UnauthorizedError(
            "Your account has been deactivated. Please contact support."
          )
        );
      }
    }

    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...roles: JwtPayload["role"][]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          "You do not have permission to perform this action."
        )
      );
    }

    next();
  };
};