import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middlewares/types";
import { FavouritesService } from "./favourites.service";
import { successResponse } from "../../../utils/helpers/response";

export class FavouritesController {

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await FavouritesService.getAll(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async toggle(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await FavouritesService.toggle(
        req.user!.userId,
        req.params.businessId
      );
      const msg = data.favourited ? "Added to favourites." : "Removed from favourites.";
      res.json(successResponse(data, msg));
    } catch (err) { next(err); }
  }
}
