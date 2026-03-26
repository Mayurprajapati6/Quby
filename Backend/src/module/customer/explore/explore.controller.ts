import { Response, NextFunction }  from "express";
import { ExploreService } from "./explore.service";
import { exploreQuerySchema } from "./explore.validator";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";
import { prisma } from "../../../config/prisma";

export class ExploreController {

  static async searchBusinesses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = exploreQuerySchema.safeParse(req.query);
      if (!result.success) {
        const first = result.error.errors[0];
        throw new BadRequestError(`${first.path.join(".")}: ${first.message}`);
      }

      const filters    = result.data;
      const userId     = req.user!.userId;

      const customer = await prisma.customer.findUnique({
        where:  { user_id: userId },
        select: { id: true, city: true, state: true },
      });

      const data = await ExploreService.searchBusinesses(
        {
          name:        filters.name,
          query:       filters.query,
          city:        filters.city  ?? customer?.city  ?? undefined,
          state:       filters.state ?? customer?.state ?? undefined,
          service_for: filters.service_for,
          min_rating:  filters.min_rating,
          is_open:     filters.is_open,
          lat:         filters.lat,
          lng:         filters.lng,
          radius_km:   filters.radius_km,
          page:        filters.page,
          limit:       filters.limit,
        },
        customer?.id ?? "",
      );

      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

}
