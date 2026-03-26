import { Router } from "express";
import { BusinessDetailController } from "./business-detail.controller";

export const businessDetailPublicRouter = Router();

businessDetailPublicRouter.get("/:slug",       BusinessDetailController.getBusinessDetail);

businessDetailPublicRouter.get("/:slug/staff", BusinessDetailController.getStaffForBooking);
