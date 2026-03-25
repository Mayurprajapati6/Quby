import { Response, NextFunction } from "express";
import { OwnerEscrowService } from "./owner-escrow.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class OwnerEscrowController {

  static async getEscrows(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerEscrowService.getEscrows(req.user!.userId, {
        business_id: req.query.business_id as string | undefined,
        status:      req.query.status      as string | undefined,
        from:        req.query.from        as string | undefined,
        to:          req.query.to          as string | undefined,
        page:        Math.max(1,  parseInt(req.query.page  as string) || 1),
        limit:       Math.min(50, parseInt(req.query.limit as string) || 20),
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getEscrowDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerEscrowService.getEscrowDetail(
        req.user!.userId, req.params.escrowId,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
