import { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { BusinessStaffService } from "./business-staff.service";
import { successResponse } from "../../../utils/helpers/response";
import { AuthRequest } from "../../../middlewares/types";
import { STAFF_MESSAGES } from "../../../constants/messages";

export class BusinessStaffController {

  static list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staff = await BusinessStaffService.listStaff(req.params.businessId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(staff));
    } catch (err) { next(err); }
  };

  static getOne = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staff = await BusinessStaffService.getStaff(req.params.businessId, req.params.staffId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(staff));
    } catch (err) { next(err); }
  };

  static create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staff = await BusinessStaffService.createStaff(req.params.businessId, req.user!.userId, req.body);
      res.status(StatusCodes.CREATED).json(successResponse(staff, STAFF_MESSAGES.CREATED));
    } catch (err) { next(err); }
  };

  static update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staff = await BusinessStaffService.updateStaff(req.params.businessId, req.params.staffId, req.user!.userId, req.body);
      res.status(StatusCodes.OK).json(successResponse(staff, STAFF_MESSAGES.UPDATED));
    } catch (err) { next(err); }
  };

  static deactivate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await BusinessStaffService.deactivateStaff(req.params.businessId, req.params.staffId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(null, STAFF_MESSAGES.DEACTIVATED));
    } catch (err) { next(err); }
  };

  static updateServices = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await BusinessStaffService.updateServices(req.params.businessId, req.params.staffId, req.user!.userId, req.body.services);
      res.status(StatusCodes.OK).json(successResponse(null, STAFF_MESSAGES.SERVICE_UPDATED));
    } catch (err) { next(err); }
  };

  static updateSchedule = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await BusinessStaffService.updateSchedule(req.params.businessId, req.params.staffId, req.user!.userId, req.body.schedule);
      res.status(StatusCodes.OK).json(successResponse(null, STAFF_MESSAGES.SCHEDULE_UPDATED));
    } catch (err) { next(err); }
  };

  static getPendingLeaves = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const leaves = await BusinessStaffService.getPendingLeaves(req.params.businessId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(leaves));
    } catch (err) { next(err); }
  };

  static processLeave = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await BusinessStaffService.processLeave(
        req.params.businessId,
        req.params.leaveId,
        req.user!.userId,
        { action: req.body.action, rejection_reason: req.body.rejection_reason }
      );
      const msg = req.body.action === "APPROVED" ? STAFF_MESSAGES.LEAVE_APPROVED : STAFF_MESSAGES.LEAVE_REJECTED;
      res.status(StatusCodes.OK).json(successResponse(result, msg));
    } catch (err) { next(err); }
  };
}