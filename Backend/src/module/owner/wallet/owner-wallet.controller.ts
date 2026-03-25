import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middlewares/types";
import { OwnerWalletService } from "./owner-wallet.service";
import { successResponse } from "../../../utils/helpers/response";

export class OwnerWalletController {

  static async getSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerWalletService.getSummary(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getEscrowHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await OwnerWalletService.getEscrowHistory(req.user!.userId, {
        businessId: req.query.businessId as string | undefined,
        status:     req.query.status     as string | undefined,
        fromDate:   req.query.fromDate   as string | undefined,
        toDate:     req.query.toDate     as string | undefined,
        page:       req.query.page  ? Number(req.query.page)  : 1,
        limit:      req.query.limit ? Number(req.query.limit) : 20,
      });
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
