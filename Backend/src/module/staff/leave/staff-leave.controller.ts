import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middlewares/types";
import { StaffLeaveService } from "./staff-leave.service";
import { successResponse } from "../../../utils/helpers/response";

export class StaffLeaveController {

  static async getLeaveRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffLeaveService.getLeaveRequests(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async requestLeave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffLeaveService.requestLeave(req.user!.userId, req.body);
      res.status(201).json(successResponse(data, "Leave request submitted successfully."));
    } catch (err) { next(err); }
  }

  static async cancelLeave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await StaffLeaveService.cancelLeave(req.user!.userId, req.params.id);
      res.json(successResponse(null, "Leave request cancelled."));
    } catch (err) { next(err); }
  }
}
