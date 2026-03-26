import { Request, Response, NextFunction } from "express";
import { BusinessDetailService } from "./business-detail.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import { prisma } from "../../../config/prisma";
import { verifyAccessToken } from "../../../utils/helpers/jwt";
import type { AuthRequest } from "../../../middlewares/types";

async function resolveOptionalCustomerProfileId(req: Request): Promise<string | undefined> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return undefined;
    const token   = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);
    if (payload.role !== "CUSTOMER") return undefined;
    const customer = await prisma.customer.findUnique({
      where:  { user_id: payload.userId },
      select: { id: true },
    });
    return customer?.id;
  } catch {
    return undefined;
  }
}

export class BusinessDetailController {

  static async getBusinessDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const customerProfileId = await resolveOptionalCustomerProfileId(req);

      const reviewRating = req.query.review_rating
        ? parseInt(req.query.review_rating as string)
        : undefined;

      if (reviewRating !== undefined && (reviewRating < 1 || reviewRating > 5)) {
        throw new BadRequestError("review_rating must be between 1 and 5.");
      }

      const reviewPage  = Math.max(1, parseInt(req.query.review_page  as string) || 1);
      const reviewLimit = Math.min(50, parseInt(req.query.review_limit as string) || 20);

      const data = await BusinessDetailService.getBusinessProfile(
        req.params.slug,
        customerProfileId,
        reviewRating,
        reviewPage,
        reviewLimit,
      );

      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getStaffForBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const slug = req.params.slug;
      const business = await prisma.business.findUnique({
        where:  { slug },
        select: { id: true, is_active: true, is_verified: true },
      });

      if (!business?.is_active || !business.is_verified) {
        throw new BadRequestError("Business not found or unavailable.");
      }

      const serviceIds: string[] = req.query.service_ids
        ? (req.query.service_ids as string).split(",").filter(Boolean)
        : [];

      const staff = await prisma.staff.findMany({
        where: {
          business_id: business.id,
          is_active:   true,
          ...(serviceIds.length > 0
            ? { services: { some: { service_offering_id: { in: serviceIds }, is_available: true } } }
            : {}),
        },
        select: {
          id:               true,
          name:             true,
          avatar_url:       true,
          specialization:   true,
          experience_years: true,
          average_rating:   true,
          total_reviews:    true,
          services: {
            where:   { is_available: true },
            select: {
              duration_minutes:   true,
              service_offering_id: true,
              service_offering: {
                select: { platform_service: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ average_rating: "desc" }, { name: "asc" }],
      });

      res.json(successResponse({
        staff: staff.map(s => ({
          id:               s.id,
          name:             s.name,
          avatar_url:       s.avatar_url ?? null,
          specialization:   s.specialization ?? null,
          experience_years: s.experience_years ?? null,
          average_rating:   s.average_rating ?? 0,
          total_reviews:    s.total_reviews,
          services:         s.services.map(sv => ({
            service_offering_id: sv.service_offering_id,
            service_name:        sv.service_offering.platform_service.name,
            duration_minutes:    sv.duration_minutes,
          })),
        })),
      }));
    } catch (err) { next(err); }
  }

  static async getStaffReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = req.query.rating
        ? parseInt(req.query.rating as string)
        : undefined;

      if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw new BadRequestError("rating must be between 1 and 5.");
      }

      const page  = Math.max(1,  parseInt(req.query.page  as string) || 1);
      const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

      const data = await BusinessDetailService.getStaffReviews(
        req.params.slug,
        req.params.staffId,
        { rating, page, limit },
      );

      res.json(successResponse(data));
    } catch (err) { next(err); }
  }
}
