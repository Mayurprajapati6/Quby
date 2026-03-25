import { Response, NextFunction } from "express";
import { StaffEscrowService } from "./staff-escrow.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffEscrowController {

  static async getEscrows(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffEscrowService.getEscrows(req.user!.userId, {
        status: req.query.status as string | undefined,
        from:   req.query.from   as string | undefined,
        to:     req.query.to     as string | undefined,
        page:   Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit:  Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
