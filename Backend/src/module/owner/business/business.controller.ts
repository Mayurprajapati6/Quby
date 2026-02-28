import { Response, NextFunction }  from "express";
import { StatusCodes }             from "http-status-codes";
import { BusinessService }         from "./business.service";
import { successResponse }         from "../../../utils/helpers/response";
import { AuthRequest }             from "../../../middlewares/types";
import { BUSINESS_MESSAGES }       from "../../../constants/messages";
import { BadRequestError }         from "../../../utils/errors/app.error";

export class BusinessController {

  static create = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        throw new BadRequestError("At least 3 business images are required.");
      }
      const business = await BusinessService.create(
        req.user!.userId,
        req.body,
        files
      );
      res.status(StatusCodes.CREATED).json(
        successResponse(business, BUSINESS_MESSAGES.CREATED)
      );
    } catch (err) { next(err); }
  };

  static getMyBusinesses = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const businesses = await BusinessService.getMyBusinesses(req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(businesses));
    } catch (err) { next(err); }
  };

  static getOne = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const business = await BusinessService.getOne(
        req.params.businessId,
        req.user!.userId
      );
      res.status(StatusCodes.OK).json(successResponse(business));
    } catch (err) { next(err); }
  };

  static update = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const business = await BusinessService.update(
        req.params.businessId,
        req.user!.userId,
        req.body
      );
      res.status(StatusCodes.OK).json(
        successResponse(business, BUSINESS_MESSAGES.UPDATED)
      );
    } catch (err) { next(err); }
  };

  static submitForVerification = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await BusinessService.submitForVerification(
        req.params.businessId,
        req.user!.userId
      );
      res.status(StatusCodes.OK).json(
        successResponse(null, BUSINESS_MESSAGES.SUBMITTED)
      );
    } catch (err) { next(err); }
  };
}