import { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { StaffService } from "./staff.service";
import { successResponse } from "../../utils/helpers/response";
import { AuthRequest } from "../../middlewares/types";

export class StaffController {

    static getProfile = async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const profile = await StaffService.getProfile(req.user!.userId);
            res.status(StatusCodes.OK).json(successResponse(profile));
        } catch (err) {
            next(err);
        }
    };

    static updateProfile = async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const updated = await StaffService.updateProfile(req.user!.userId, req.body);
            res.status(StatusCodes.OK).json(successResponse(updated, "Profile updated successfully."));
        } catch (err) {
            next(err);
        }
    };
}