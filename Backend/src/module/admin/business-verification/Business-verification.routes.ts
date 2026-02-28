import express from "express";
import { BusinessVerificationController } from "./Business-verification.controller";
import { validateRequestBody } from "../../../validators";
import { rejectBusinessSchema } from "../../../validators/business.validator";

const router = express.Router();

router.get("/", BusinessVerificationController.getPending);
router.get("/:businessId", BusinessVerificationController.getDetail);
router.post("/:businessId/approve", BusinessVerificationController.approve);
router.post("/:businessId/reject", validateRequestBody(rejectBusinessSchema), BusinessVerificationController.reject);

export default router;