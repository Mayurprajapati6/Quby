import { Router } from "express";
import { OwnerBusinessController } from "./business.controller";
import { validateRequestBody } from "../../../validators";
import { uploadFields, uploadArray, handleMulterError } from "../../../utils/helpers/multer";
import { createBusinessSchema, updateBusinessSchema } from "./business.validator";
import { ownerBusinessStaffRouter } from "../business-staff/business-staff.routes";
import { businessServicesRouter } from "../business-services/business-services.routes";
import { scheduleRouter } from "../schedule/schedule.routes";
import { ownerHolidayRouter } from "../holiday/owner-holiday.routes";

export const ownerBusinessRouter = Router();

ownerBusinessRouter.get("/", OwnerBusinessController.listMyBusinesses);

ownerBusinessRouter.post(
  "/",
  uploadFields([{ name: "logo", maxCount: 1 }, { name: "cover", maxCount: 1 }]),
  handleMulterError,
  validateRequestBody(createBusinessSchema),
  OwnerBusinessController.createBusiness,
);

ownerBusinessRouter.get("/:businessId", OwnerBusinessController.getMyBusiness);

ownerBusinessRouter.patch(
  "/:businessId",
  uploadFields([{ name: "logo", maxCount: 1 }, { name: "cover", maxCount: 1 }]),
  handleMulterError,
  validateRequestBody(updateBusinessSchema),
  OwnerBusinessController.updateBusiness,
);

ownerBusinessRouter.delete("/:businessId", OwnerBusinessController.deleteBusiness);

ownerBusinessRouter.post(
  "/:businessId/images",
  uploadArray("images", 10),
  handleMulterError,
  OwnerBusinessController.uploadImages,
);

ownerBusinessRouter.delete(
  "/:businessId/images/:imageId",
  OwnerBusinessController.deleteImage,
);

ownerBusinessRouter.patch(
  "/:businessId/images/:imageId/primary",
  OwnerBusinessController.setPrimaryImage,
);

ownerBusinessRouter.post(
  "/:businessId/submit-verification",
  OwnerBusinessController.submitForVerification,
);

ownerBusinessRouter.use("/:businessId/staff", ownerBusinessStaffRouter);

ownerBusinessRouter.use("/:businessId/services", businessServicesRouter);

ownerBusinessRouter.use("/:businessId/schedule", scheduleRouter);

ownerBusinessRouter.use("/:businessId/holidays", ownerHolidayRouter);
