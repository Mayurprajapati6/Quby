import { Router } from "express";
import { PlatformServicesController } from "./platform-services.controller";
import { validateRequestBody } from "../../../validators";
import {
  createPlatformServiceSchema,
  updatePlatformServiceSchema,
} from "../../../validators/platform-services.validator";
import { uploadSingle, handleMulterError } from "../../../utils/helpers/multer";

export const platformServicesRouter = Router();

platformServicesRouter.get("/", PlatformServicesController.list);

platformServicesRouter.post(
  "/",
  uploadSingle,
  handleMulterError,
  validateRequestBody(createPlatformServiceSchema),
  PlatformServicesController.create,
);

platformServicesRouter.patch(
  "/:id",
  uploadSingle,
  handleMulterError,
  validateRequestBody(updatePlatformServiceSchema),
  PlatformServicesController.update,
);

platformServicesRouter.delete("/:id", PlatformServicesController.delete);
