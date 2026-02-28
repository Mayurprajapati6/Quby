import { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { BusinessServicesService } from "./business-services.service";
import { successResponse } from "../../../utils/helpers/response";
import { AuthRequest } from "../../../middlewares/types";
import { BUSINESS_MESSAGES } from "../../../constants/messages";

export class BusinessServicesController {

  static list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await BusinessServicesService.list(req.params.businessId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(services));
    } catch (err) { next(err); }
  };

  static add = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const service = await BusinessServicesService.add(req.params.businessId, req.user!.userId, req.body);
      res.status(StatusCodes.CREATED).json(successResponse(service, BUSINESS_MESSAGES.SERVICE_ADDED));
    } catch (err) { next(err); }
  };

  static update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const service = await BusinessServicesService.update(
        req.params.businessId,
        req.params.offeringId,
        req.user!.userId,
        req.body
      );
      res.status(StatusCodes.OK).json(successResponse(service, BUSINESS_MESSAGES.SERVICE_UPDATED));
    } catch (err) { next(err); }
  };

  static remove = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await BusinessServicesService.remove(req.params.businessId, req.params.offeringId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(null, BUSINESS_MESSAGES.SERVICE_REMOVED));
    } catch (err) { next(err); }
  };
}