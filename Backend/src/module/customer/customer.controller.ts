import { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { CustomerService } from "./customer.service";
import { successResponse } from "../../utils/helpers/response";
import { AuthRequest } from "../../middlewares/types";

export class CustomerController {

  static getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await CustomerService.getProfile(req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(profile));
    } catch (err) {
      next(err);
    }
  };

  static updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updated = await CustomerService.updateProfile(
        req.user!.userId,
        req.body,
        req.file   
      );
      res.status(StatusCodes.OK).json(successResponse(updated, "Profile updated successfully."));
    } catch (err) {
      next(err);
    }
  };
}