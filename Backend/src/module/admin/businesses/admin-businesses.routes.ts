import { Router } from "express";
import { AdminBusinessesController } from "./admin-businesses.controller";
import { suspendSchema, validateRequestBody } from "../../../validators";


export const adminBusinessesRouter = Router();

adminBusinessesRouter.get("/", AdminBusinessesController.getBusinesses);

adminBusinessesRouter.get("/:businessId", AdminBusinessesController.getBusinessDetail);

adminBusinessesRouter.patch(
  "/:businessId/suspend",
  validateRequestBody(suspendSchema),
  AdminBusinessesController.suspendBusiness,
);

adminBusinessesRouter.patch("/:businessId/unsuspend", AdminBusinessesController.unsuspendBusiness);
