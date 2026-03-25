import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middlewares/types";
import { BusinessServicesService } from "./business-services.service";
import { successResponse } from "../../../utils/helpers/response";

export class BusinessServicesController {

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessServicesService.getAll(
        req.user!.userId,
        req.params.businessId,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async add(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessServicesService.add(
        req.user!.userId,
        req.params.businessId,
        req.body,
      );
      res.status(201).json(successResponse(data, "Service added successfully."));
    } catch (err) { next(err); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessServicesService.update(
        req.user!.userId,
        req.params.businessId,
        req.params.serviceId,
        req.body,
      );
      res.json(successResponse(data, "Service updated successfully."));
    } catch (err) { next(err); }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessServicesService.remove(
        req.user!.userId,
        req.params.businessId,
        req.params.serviceId,
      );
      res.json(successResponse(null, "Service removed successfully."));
    } catch (err) { next(err); }
  }
}
