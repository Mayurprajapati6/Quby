import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middlewares/types";
import { CustomerWalletService } from "./customer-wallet.service";
import { successResponse }  from "../../../utils/helpers/response";

export class CustomerWalletController {

  static async getWallet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await CustomerWalletService.getWallet(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page  = req.query.page  ? parseInt(req.query.page  as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const data  = await CustomerWalletService.getTransactions(
        req.user!.userId,
        page,
        limit
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
