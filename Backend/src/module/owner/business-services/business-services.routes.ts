import { Router } from "express";
import { BusinessServicesController } from "./business-services.controller";
import { validateRequestBody } from "../../../validators";
import {
  addBusinessServiceSchema,
  updateBusinessServiceSchema,
} from "../../../validators/business-services.validator";

export const businessServicesRouter = Router({ mergeParams: true });

businessServicesRouter.get("/", BusinessServicesController.getAll);

businessServicesRouter.post(
  "/",
  validateRequestBody(addBusinessServiceSchema),
  BusinessServicesController.add,
);

businessServicesRouter.patch(
  "/:serviceId",
  validateRequestBody(updateBusinessServiceSchema),
  BusinessServicesController.update,
);

businessServicesRouter.delete("/:serviceId", BusinessServicesController.remove);
