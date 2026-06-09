import { Response, NextFunction } from "express";
import { AdminBusinessesService } from "./admin-businesses.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

function parseBool(val: string | undefined): boolean | undefined {
  if (val === "true")  return true;
  if (val === "false") return false;
  return undefined;
}

function pagination(req: AuthRequest) {
  return {
    page:  Math.max(1,   parseInt(req.query.page  as string) || 1),
    limit: Math.min(100, parseInt(req.query.limit as string) || 20),
  };
}

export class AdminBusinessesController {

  static async getBusinesses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminBusinessesService.getBusinesses({
        search:    req.query.search    as string | undefined,
        city:      req.query.city      as string | undefined,
        state:     req.query.state     as string | undefined,
        is_active: parseBool(req.query.is_active as string),
        ...pagination(req),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getBusinessDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminBusinessesService.getBusinessDetail(req.params.businessId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getBusinessReviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await AdminBusinessesService.getBusinessReviews(
      req.params.businessId,
      {
        page:  Math.max(1, parseInt(req.query.page as string) || 1),
        limit: Math.min(50, parseInt(req.query.limit as string) || 10),
        rating: req.query.rating ? Number(req.query.rating) : undefined,
      }
    );

    res.json(successResponse(data));
  } catch (err) {
    next(err);
  }
}
}
