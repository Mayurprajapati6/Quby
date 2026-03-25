import { Response, NextFunction }  from "express";
import { BusinessStaffService } from "./business-staff.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class BusinessStaffController {

  static async getAllStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getStaffAcrossBusinesses(req.user!.userId, {
        name:        req.query.name        as string | undefined,
        business_id: req.query.business_id as string | undefined,
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getStaffByBusiness(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getStaffByBusiness(
        req.user!.userId,
        req.params.businessId,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async createStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.createStaff(
        req.user!.userId,
        req.params.businessId,
        req.body,
        req.file,
      );
      res.status(201).json(successResponse(data, "Staff member invited successfully."));
    } catch (err) { next(err); }
  }

  static async getStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getStaff(req.user!.userId, req.params.staffId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async updateStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.updateStaff(
        req.user!.userId, req.params.staffId, req.body, req.file,
      );
      res.json(successResponse(data, "Staff member updated."));
    } catch (err) { next(err); }
  }

  static async updateStaffServices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.updateStaffServices(
        req.user!.userId, req.params.staffId, req.body,
      );
      res.json(successResponse(data, "Staff services updated."));
    } catch (err) { next(err); }
  }

  static async updateStaffSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.updateStaffSchedule(
        req.user!.userId, req.params.staffId, req.body,
      );
      res.json(successResponse(data, "Staff schedule updated."));
    } catch (err) { next(err); }
  }

  static async toggleActive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.toggleActive(
        req.user!.userId, req.params.staffId, req.body.is_active,
      );
      res.json(successResponse(data, `Staff ${data.is_active ? "activated" : "deactivated"}.`));
    } catch (err) { next(err); }
  }

  static async deleteStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessStaffService.deleteStaff(req.user!.userId, req.params.staffId);
      res.json(successResponse(null, "Staff member removed."));
    } catch (err) { next(err); }
  }

  static async resendInvitation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.resendInvitation(req.user!.userId, req.params.staffId);
      res.json(successResponse(data, "Invitation resent."));
    } catch (err) { next(err); }
  }

  static async getLeaveRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getLeaveRequests(req.user!.userId, {
        status:      req.query.status      as string | undefined,
        business_id: req.query.business_id as string | undefined,
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async processLeave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.processLeave(
        req.user!.userId,
        req.params.leaveId,
        req.body.action,
        req.body.rejection_reason,
      );
      res.json(successResponse(data, `Leave request ${req.body.action.toLowerCase()}d.`));
    } catch (err) { next(err); }
  }

  static async getSetupStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessStaffService.getSetupPendingStaff(
        req.user!.userId,
        req.query.business_id as string | undefined,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}