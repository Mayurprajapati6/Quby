import { Response, NextFunction } from "express";
import { StaffOperationService } from "./staff-operation.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffOperationController {

  static async getLeaves(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffOperationService.getLeaves(
        req.user!.userId,
        req.query.status as string | undefined,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async requestLeave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffOperationService.requestLeave(req.user!.userId, req.body);
      res.status(201).json(successResponse(data, "Leave request submitted."));
    } catch (err) { next(err); }
  }

  static async cancelLeave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffOperationService.cancelLeave(
        req.user!.userId,
        req.params.leaveId,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
