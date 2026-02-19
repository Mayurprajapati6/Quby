import { NextFunction, Response } from "express";
import { verifyAccessToken } from "../utils/helpers/jwt";
import { UnauthorizedError } from "../utils/errors/app.error";
import { AuthRequest } from "./types";
import { prisma } from "../config/prisma";

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
      select: { version: true, is_active: true },
    });

    if (!user) {
      return next(new UnauthorizedError("Account not found."));
    }

    if (!user.is_active) {
      return next(new UnauthorizedError("Your account has been deactivated. Please contact support."));
    }

    if (user.version !== payload.version) {
      return next(new UnauthorizedError("Session expired. Please login again."));
    }

    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
};