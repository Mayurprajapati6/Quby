import { Response, NextFunction } from "express";
import { OwnerLeaveService } from "./owner-leave.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class OwnerLeaveController {

  static async getLeaveRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerLeaveService.getLeaveRequests(req.user!.userId, {
        status:      req.query.status      as string | undefined,
        business_id: req.query.business_id as string | undefined,
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async processLeave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerLeaveService.processLeave(
        req.user!.userId,
        req.params.leaveId,
        req.body,
      );
      res.json(successResponse(data, `Leave request ${req.body.action.toLowerCase()}d.`));
    } catch (err) { next(err); }
  }
}
