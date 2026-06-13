import { Response, NextFunction } from "express";
import { BusinessStaffService } from "./business-staff.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class BusinessStaffController {

  static async getStaffList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getStaffList(req.user!.businessId!);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getStaffDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getStaffDetail(
        req.params.staffId, req.user!.businessId!,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async updateStaffSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.updateStaffSchedule(
        req.params.staffId, req.user!.businessId!, req.body.schedules,
      );
      res.json(successResponse(data, "Staff schedule updated."));
    } catch (err) { next(err); }
  }

  static async getStaffLeaves(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getStaffLeaves(
        req.params.staffId,
        req.user!.businessId!,
        req.query.status as string | undefined,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getStaffAttendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getStaffAttendance(
        req.params.staffId,
        req.user!.businessId!,
        req.query.month as string | undefined,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
