import { Response, NextFunction } from "express";
import { AdminUsersService } from "./admin-users.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

function pagination(req: AuthRequest) {
  return {
    page:  Math.max(1,   parseInt(req.query.page  as string) || 1),
    limit: Math.min(100, parseInt(req.query.limit as string) || 20),
  };
}

function parseBool(val: string | undefined): boolean | undefined {
  if (val === "true")  return true;
  if (val === "false") return false;
  return undefined;
}

export class AdminUsersController {

  static async getOwners(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminUsersService.getOwners({
        search:       req.query.search       as string | undefined,
        is_suspended: parseBool(req.query.is_suspended as string),
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
        search:       req.query.search       as string | undefined,
        city:         req.query.city         as string | undefined,
        state:        req.query.state        as string | undefined,
        is_suspended: parseBool(req.query.is_suspended as string),
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

  static async suspendUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      if (!reason?.trim()) throw new BadRequestError("reason is required to suspend a user.");
      const data = await AdminUsersService.suspendUser(req.params.userId, reason.trim());
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async unsuspendUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AdminUsersService.unsuspendUser(req.params.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}