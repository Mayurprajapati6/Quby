import { NextFunction, Request, Response } from "express";
import { ZodTypeAny, ZodError } from "zod";
import logger from "../config/logger.config";
import { BadRequestError } from "../utils/errors/app.error";

/**
 * Validate request body
 */
export const validateRequestBody = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info("Validating request body");
      await schema.parseAsync(req.body);
      logger.info("Request body is valid");
      next();
    } catch (error) {
      logger.error("Request body is invalid");
      
      // Better error formatting
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return next(new BadRequestError('Validation failed'));
        // You could also pass formattedErrors as details
      }
      
      next(new BadRequestError('Invalid request body'));
    }
  };
};

/**
 * Validate query params
 */
export const validateQueryParams = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.query);
      console.log("Query params are valid");
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new BadRequestError('Invalid query parameters'));
      }
      
      next(new BadRequestError('Invalid query params'));
    }
  };
};