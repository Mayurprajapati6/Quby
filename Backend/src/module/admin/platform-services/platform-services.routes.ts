// ─────────────────────────────────────────────────────────────────────────────
// MODULE : admin / platform-services
// FILE   : platform-services.routes.ts
// CHANGE : POST + PATCH now use uploadSingle + handleMulterError middleware
//          Image uploaded as multipart/form-data field "image"
// ─────────────────────────────────────────────────────────────────────────────

import express                                       from "express";
import { PlatformServicesController }                from "./platform-services.controller";
import { validateRequestBody }                       from "../../../validators";
import {
  createPlatformServiceSchema,
  updatePlatformServiceSchema,
} from "../../../validators/platform-services.validator";
import { uploadSingle, handleMulterError }           from "../../../utils/helpers/multer";

const router = express.Router();

router.get("/", PlatformServicesController.list);

router.post(
  "/",
  uploadSingle,
  handleMulterError,
  validateRequestBody(createPlatformServiceSchema),
  PlatformServicesController.create
);

router.patch(
  "/:id",
  uploadSingle,
  handleMulterError,
  validateRequestBody(updatePlatformServiceSchema),
  PlatformServicesController.update
);

router.delete("/:id", PlatformServicesController.delete);

export default router;