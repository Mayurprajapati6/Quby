import { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { OwnerService } from "./owner.service";
import { successResponse } from "../../utils/helpers/response";
import { AuthRequest } from "../../middlewares/types";

export class OwnerController {
  static getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await OwnerService.getProfile(req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(profile));
    } catch (err) {
      next(err);
    }
  };

  static updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updated = await OwnerService.updateProfile(req.user!.userId, req.body);
      res.status(StatusCodes.OK).json(successResponse(updated, "Profile updated successfully."));
    } catch (err) {
      next(err);
    }
  };
}