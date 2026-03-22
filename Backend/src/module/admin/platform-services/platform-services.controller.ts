import { Response, NextFunction } from "express";
import { PlatformServicesService } from "./platform-services.service";
import { successResponse } from "../../../utils/helpers/response";
import { PLATFORM_SERVICE_MESSAGES } from "../../../constants/messages";
import type { AuthRequest } from "../../../middlewares/types";
export class PlatformServicesController {
  
  static list = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { category, service_for, is_active } = req.query as Record<string, string>;
      const services = await PlatformServicesService.list({
        category:    category    as "SALON" | undefined,
        service_for: service_for as "MEN" | "UNISEX" | undefined,
        is_active:   is_active !== undefined ? is_active === "true" : undefined,
      });
      res.json(successResponse(services));
    } catch (err) { next(err); }
  };

  static create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const service = await PlatformServicesService.create(req.body, req.file);
      res.status(201).json(successResponse(service, PLATFORM_SERVICE_MESSAGES.CREATED));
    } catch (err) { next(err); }
  };

  static update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const updated = await PlatformServicesService.update(req.params.id, req.body, req.file);
      res.json(successResponse(updated, PLATFORM_SERVICE_MESSAGES.UPDATED));
    } catch (err) { next(err); }
  };

  static delete = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await PlatformServicesService.delete(req.params.id);
      res.json(successResponse(null, PLATFORM_SERVICE_MESSAGES.DELETED));
    } catch (err) { next(err); }
  };
}
