import { Router } from "express";
import { BusinessDetailController } from "./business-detail.controller";

export const businessDetailRouter = Router();

businessDetailRouter.get("/:slug", BusinessDetailController.getBusinessDetail);
businessDetailRouter.get("/:slug/staff", BusinessDetailController.getStaffForBooking);
