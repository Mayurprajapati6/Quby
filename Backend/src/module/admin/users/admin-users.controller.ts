import { Response, NextFunction } from "express";
import { AdminUsersService } from "./admin-users.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

function pagination(req: AuthRequest) {
  return {
    page:  Math.max(1,   parseInt(req.query.page  as string) || 1),
    limit: Math.min(100, parseInt(req.query.limit as string) || 20),
  };
}

export class AdminUsersController {

  static async getOwners(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminUsersService.getOwners({
        search: req.query.search as string | undefined,
        city:   req.query.city   as string | undefined,
        state:  req.query.state  as string | undefined,
        ...pagination(req),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getOwnerDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminUsersService.getOwnerDetail(req.params.ownerId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getCustomers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminUsersService.getCustomers({
        search: req.query.search as string | undefined,
        city:   req.query.city   as string | undefined,
        state:  req.query.state  as string | undefined,
        ...pagination(req),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getCustomerDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminUsersService.getCustomerDetail(req.params.customerId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminUsersService.getStaff({
        search:      req.query.search      as string | undefined,
        business_id: req.query.business_id as string | undefined,
        ...pagination(req),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getStaffDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminUsersService.getStaffDetail(req.params.staffId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  // 🔥 ADD THIS
static async getStaffReviews(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { staffId } = req.params as { staffId: string };

    const data = await AdminUsersService.getStaffReviews(staffId);

    res.json(successResponse(data));
  } catch (err) {
    next(err);
  }
}
}
