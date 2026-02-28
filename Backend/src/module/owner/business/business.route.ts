import express from "express";
import { BusinessController }  from "./business.controller";
import { validateRequestBody } from "../../../validators";
import { createBusinessSchema, updateBusinessSchema}  from "../../../validators/business.validator";
import { uploadMultiple, handleMulterError} from "../../../utils/helpers/multer";

const router = express.Router();

router.get("/", BusinessController.getMyBusinesses);

router.post(
  "/",
  uploadMultiple,
  handleMulterError,
  validateRequestBody(createBusinessSchema),
  BusinessController.create
);

router.get("/:businessId", BusinessController.getOne);

router.patch(
  "/:businessId",
  validateRequestBody(updateBusinessSchema),
  BusinessController.update
);

router.post("/:businessId/submit", BusinessController.submitForVerification);

export default router;