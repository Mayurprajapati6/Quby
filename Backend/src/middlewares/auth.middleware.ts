import { NextFunction, Response } from "express";
import { verifyAccessToken } from "../utils/helpers/jwt";
import { UnauthorizedError } from "../utils/errors/app.error";
import { AuthRequest } from "./types";
import { prisma } from "../config/prisma";
import { JwtPayload } from "../module/auth/auth.types";

export const authenticate = async (
  req:  AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next(new UnauthorizedError("Authorization token missing."));
    }

    const token   = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: { version: true, is_active: true, is_suspended: true, role: true },
    });

    if (!user) return next(new UnauthorizedError("Account not found."));

    if (user.version !== payload.version) {
      return next(new UnauthorizedError("Session expired. Please login again."));
    }

    if ((user as any).is_suspended) {
      return next(new UnauthorizedError("Your account has been suspended. Please contact support."));
    }

    switch (user.role) {

      case "STAFF": {
        if (!user.is_active) {
          return next(new UnauthorizedError("You are no longer associated with a business."));
        }
        const staff = await prisma.staff.findUnique({
          where:  { user_id: payload.userId },
          select: { is_active: true },
        });
        if (!staff?.is_active) {
          return next(new UnauthorizedError("You are no longer associated with a business."));
        }
        break;
      }

      case "ADMIN": {
        const admin = await prisma.admin.findUnique({
          where:  { user_id: payload.userId },
          select: { is_active: true },
        });
        if (!admin?.is_active) {
          return next(new UnauthorizedError("Your account has been deactivated."));
        }
        break;
      }

      case "BUSINESS": {
        if (!user.is_active) {
          return next(new UnauthorizedError("This saloon account has been deactivated."));
        }
        const business = await prisma.business.findUnique({
          where:  { auth_user_id: payload.userId },
          select: { is_active: true, id: true },
        });
        if (!business?.is_active) {
          return next(new UnauthorizedError("This saloon account has been deactivated."));
        }
        if (payload.businessId !== business.id) {
          return next(new UnauthorizedError("Invalid session. Please login again."));
        }
        break;
      }

      default: {
        if (!user.is_active) {
          return next(new UnauthorizedError("Your account has been deactivated."));
        }
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
    if (!req.user) return next(new UnauthorizedError("Authentication required."));
    if (!roles.includes(req.user.role)) {
      return next(new UnauthorizedError("You do not have permission to perform this action."));
    }
    next();
  };
};

export const authorizeRoles = requireRole;
