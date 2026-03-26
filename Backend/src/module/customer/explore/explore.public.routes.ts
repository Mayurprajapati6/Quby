import { Router, Request, Response, NextFunction } from "express";
import { ExploreService } from "./explore.service";
import { exploreQuerySchema } from "./explore.validator";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import { prisma } from "../../../config/prisma";
import { verifyAccessToken }  from "../../../utils/helpers/jwt";

export const explorePublicRouter = Router();

async function resolveOptionalCustomer(req: Request): Promise<{ id: string; city: string; state: string } | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token   = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);
    if (payload.role !== "CUSTOMER") return null;
    return prisma.customer.findUnique({
      where:  { user_id: payload.userId },
      select: { id: true, city: true, state: true },
    });
  } catch {
    return null;
  }
}

explorePublicRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = exploreQuerySchema.safeParse(req.query);
    if (!result.success) {
      const first = result.error.errors[0];
      throw new BadRequestError(`${first.path.join(".")}: ${first.message}`);
    }

    const filters  = result.data;
    const customer = await resolveOptionalCustomer(req);

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
});
