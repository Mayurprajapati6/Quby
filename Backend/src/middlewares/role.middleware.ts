import { NextFunction, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors/app.error";
import { AuthRequest } from "./types";
import { JwtPayload } from "../module/auth/auth.types";

export const authorizeRoles = (...roles: Array<JwtPayload['role']>) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Unauthorized"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError("Access denied"));
    }

    next();
  };
};
