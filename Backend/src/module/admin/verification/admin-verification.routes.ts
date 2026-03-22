import { Router } from "express";
import { AdminVerificationController } from "./admin-verification.controller";
import { rejectVerificationSchema, validateRequestBody } from "../../../validators";


export const adminVerificationRouter = Router();

adminVerificationRouter.get("/", AdminVerificationController.getPending);
adminVerificationRouter.get("/:businessId", AdminVerificationController.getBusinessForReview);

adminVerificationRouter.post("/:businessId/approve", AdminVerificationController.approve);
adminVerificationRouter.post(
  "/:businessId/reject",
  validateRequestBody(rejectVerificationSchema),
  AdminVerificationController.reject,
);
