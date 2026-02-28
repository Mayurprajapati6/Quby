import { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { BusinessVerificationService } from "./business-verification.service";
import { successResponse } from "../../../utils/helpers/response";
import { AuthRequest } from "../../../middlewares/types";
import { BUSINESS_MESSAGES } from "../../../constants/messages";

export class BusinessVerificationController {

  static getPending = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page  = parseInt(req.query.page  as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await BusinessVerificationService.getPendingBusinesses(page, limit);
      res.status(StatusCodes.OK).json(result);
    } catch (err) { next(err); }
  };

  static getDetail = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const business = await BusinessVerificationService.getBusinessDetail(req.params.businessId);
      res.status(StatusCodes.OK).json(successResponse(business));
    } catch (err) { next(err); }
  };

  static approve = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const business = await BusinessVerificationService.approve(req.params.businessId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(business, BUSINESS_MESSAGES.APPROVED));
    } catch (err) { next(err); }
  };

  static reject = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const business = await BusinessVerificationService.reject(req.params.businessId, req.body.reason);
      res.status(StatusCodes.OK).json(successResponse(business, BUSINESS_MESSAGES.REJECTED));
    } catch (err) { next(err); }
  };
}