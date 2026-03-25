import { Response, NextFunction } from "express";
import { BusinessService } from "./business.service";
import { successResponse } from "../../../utils/helpers/response";
import type { AuthRequest } from "../../../middlewares/types";

export class OwnerBusinessController {

  static async listMyBusinesses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessService.listMyBusinesses(
        req.user!.userId,
        {
          name:  req.query.name  as string | undefined,
          city:  req.query.city  as string | undefined,
          state: req.query.state as string | undefined,
        },
        Math.max(1,  parseInt(req.query.page  as string) || 1),
        Math.min(50, parseInt(req.query.limit as string) || 10),
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getMyBusiness(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessService.getMyBusiness(req.user!.userId, req.params.businessId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async createBusiness(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const files  = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const logo   = files?.logo?.[0];
      const cover  = files?.cover?.[0];
      const data   = await BusinessService.createBusiness(req.user!.userId, req.body, logo, cover);
      res.status(201).json(successResponse(data, "Business created successfully."));
    } catch (err) { next(err); }
  }

  static async updateBusiness(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const logo  = files?.logo?.[0];
      const cover = files?.cover?.[0];
      const data  = await BusinessService.updateBusiness(
        req.user!.userId,
        req.params.businessId,
        req.body,
        logo,
        cover,
      );
      res.json(successResponse(data, "Business updated."));
    } catch (err) { next(err); }
  }

  static async deleteBusiness(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessService.deleteBusiness(req.user!.userId, req.params.businessId);
      res.json(successResponse(null, "Business deleted."));
    } catch (err) { next(err); }
  }

  static async uploadImages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
      const data  = await BusinessService.uploadImages(
        req.user!.userId,
        req.params.businessId,
        files,
      );
      res.status(201).json(successResponse(data, "Images uploaded."));
    } catch (err) { next(err); }
  }

  static async deleteImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BusinessService.deleteImage(
        req.user!.userId,
        req.params.businessId,
        req.params.imageId,
      );
      res.json(successResponse(null, "Image deleted."));
    } catch (err) { next(err); }
  }

  static async setPrimaryImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessService.setPrimaryImage(
        req.user!.userId,
        req.params.businessId,
        req.params.imageId,
      );
      res.json(successResponse(data, "Primary image updated."));
    } catch (err) { next(err); }
  }

  static async submitForVerification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await BusinessService.submitForVerification(
        req.user!.userId,
        req.params.businessId,
      );
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
