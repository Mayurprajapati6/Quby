import { Response, NextFunction } from "express";
import { BusinessTodayService } from "./business-today.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class BusinessTodayController {

  static async getTodayQueue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessTodayService.getTodayQueue(req.user!.businessId!);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
