import { NextFunction, Request, Response } from "express";
import { ZodTypeAny, ZodError } from "zod";
import logger from "../config/logger.config";
import { BadRequestError } from "../utils/errors/app.error";

export const validateRequestBody = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.errors[0];
        const field      = firstIssue.path.join(".");
        const message    = field
          ? `${field}: ${firstIssue.message}`
          : firstIssue.message;
        return next(new BadRequestError(message));
      }
      logger.warn("[Validator] Unexpected body validation error:", error);
      next(new BadRequestError("Invalid request body."));
    }
  };
};

export const validateRequestQuery = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      //req.query = await schema.parseAsync(req.query) as typeof req.query;
      const parsed = await schema.parseAsync(req.query)
Object.assign(req.query, parsed)
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.errors[0];
        const field      = firstIssue.path.join(".");
        const message    = field
          ? `${field}: ${firstIssue.message}`
          : firstIssue.message;
        return next(new BadRequestError(message));
      }
      logger.warn("[Validator] Unexpected query validation error:", error);
      next(new BadRequestError("Invalid query parameters."));
    }
  };
};

export const validateQueryParams = validateRequestQuery;

export * from "./auth.validator";
export * from "./admin.validator";
export * from "./owner.validator";
export * from "./business.validator";
export * from "./business-services.validator";
export * from "./business-staff.validator";
export * from "./customer.validator";
export * from "./booking.validator";
export * from "./staff.validator";
export * from "./staff-queue.validator";
export * from "./staff-leave.validator";
export * from "./payment.validator";
export * from "./schedule.validator";
export * from "./platform-services.validator";
export * from "./review.validator";
