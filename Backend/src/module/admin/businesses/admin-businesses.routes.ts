import { Router } from "express";
import { AdminBusinessesController } from "./admin-businesses.controller";

export const adminBusinessesRouter = Router();

adminBusinessesRouter.get("/", AdminBusinessesController.getBusinesses);

adminBusinessesRouter.get("/:businessId", AdminBusinessesController.getBusinessDetail);

adminBusinessesRouter.get(
  "/:businessId/reviews",
  AdminBusinessesController.getBusinessReviews
);