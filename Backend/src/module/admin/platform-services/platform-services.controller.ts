import { Response, NextFunction }       from "express";
import { StatusCodes }                   from "http-status-codes";
import { PlatformServicesService }       from "./platform-services.service";
import { successResponse }               from "../../../utils/helpers/response";
import { AuthRequest }                   from "../../../middlewares/types";
import { PLATFORM_SERVICE_MESSAGES }     from "../../../constants/messages";

export class PlatformServicesController {

  static list = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { service_for, is_active } = req.query as Record<string, string>;
      const services = await PlatformServicesService.list({
        service_for: service_for as "MEN" | "UNISEX" | undefined,
        is_active:   is_active !== undefined ? is_active === "true" : undefined,
      });
      res.status(StatusCodes.OK).json(successResponse(services));
    } catch (err) { next(err); }
  };

  static create = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const service = await PlatformServicesService.create(
        req.body,
        req.file       
      );
      res.status(StatusCodes.CREATED).json(
        successResponse(service, PLATFORM_SERVICE_MESSAGES.CREATED)
      );
    } catch (err) { next(err); }
  };

  static update = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await PlatformServicesService.update(
        req.params.id,
        req.body,
        req.file        
      );
      res.status(StatusCodes.OK).json(
        successResponse(updated, PLATFORM_SERVICE_MESSAGES.UPDATED)
      );
    } catch (err) { next(err); }
  };

  static delete = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await PlatformServicesService.delete(req.params.id);
      res.status(StatusCodes.OK).json(
        successResponse(null, PLATFORM_SERVICE_MESSAGES.DELETED)
      );
    } catch (err) { next(err); }
  };
}