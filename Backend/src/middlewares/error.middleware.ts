import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import logger from "../config/logger.config";

export function appErrorHandler(
  err:  Error,
  _req: Request,
  res:  Response,
  next: NextFunction,
): void {
  if ((err as any).statusCode) {
    res.status((err as any).statusCode).json({ success: false, message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: err.errors[0]?.message ?? "Validation error",
      errors:  err.errors,
    });
    return;
  }

  if ((err as any).code === "P2002") {
    res.status(409).json({ success: false, message: "A record with this value already exists." });
    return;
  }

  if ((err as any).code === "P2025") {
    res.status(404).json({ success: false, message: "Record not found." });
    return;
  }

  next(err);
}

export function genericErrorHandler(
  err:  Error,
  _req: Request,
  res:  Response,
  _next: NextFunction,
): void {
  logger.error("[Error Handler]", { message: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
}

export const errorHandler = appErrorHandler;
