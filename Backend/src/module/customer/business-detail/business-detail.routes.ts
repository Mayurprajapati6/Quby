import { Router } from "express";
import { BusinessDetailController } from "./business-detail.controller";
import { businessDetailPublicRouter } from "./business-detail.public.routes";

export const businessDetailRouter = Router();

businessDetailRouter.use("/", businessDetailPublicRouter);

businessDetailRouter.get(
  "/:slug/staff/:staffId/reviews",
  BusinessDetailController.getStaffReviews,
);

businessDetailRouter.get(
  "/:slug/reviews",
  BusinessDetailController.getBusinessReviews,
);

export default businessDetailRouter;