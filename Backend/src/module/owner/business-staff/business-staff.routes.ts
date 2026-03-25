import { Router } from "express";
import { BusinessStaffController } from "./business-staff.controller";
import { validateRequestBody } from "../../../validators";
import {
  createStaffSchema,
  updateStaffSchema,
  updateStaffServicesSchema,
  updateStaffScheduleSchema,
  toggleStaffActiveSchema,
} from "../../../validators/business-staff.validator";
import { processLeaveSchema } from "../../../validators/owner.validator";
import { uploadSingle, handleMulterError } from "../../../utils/helpers/multer";
import { staffDetailRouter } from "../staff-detail/staff-detail.routes";

export const ownerStaffRouter = Router();

ownerStaffRouter.get("/", BusinessStaffController.getAllStaff);

ownerStaffRouter.get("/setup-status", BusinessStaffController.getSetupStatus);

ownerStaffRouter.get("/:staffId", BusinessStaffController.getStaff);
ownerStaffRouter.patch(
  "/:staffId",
  uploadSingle, handleMulterError,
  validateRequestBody(updateStaffSchema),
  BusinessStaffController.updateStaff,
);
ownerStaffRouter.patch(
  "/:staffId/services",
  validateRequestBody(updateStaffServicesSchema),
  BusinessStaffController.updateStaffServices,
);
ownerStaffRouter.patch(
  "/:staffId/schedule",
  validateRequestBody(updateStaffScheduleSchema),
  BusinessStaffController.updateStaffSchedule,
);
ownerStaffRouter.patch(
  "/:staffId/toggle-active",
  validateRequestBody(toggleStaffActiveSchema),
  BusinessStaffController.toggleActive,
);
ownerStaffRouter.delete("/:staffId", BusinessStaffController.deleteStaff);
ownerStaffRouter.post("/:staffId/resend-invitation", BusinessStaffController.resendInvitation);

ownerStaffRouter.use("/:staffId/detail", staffDetailRouter);

export const ownerBusinessStaffRouter = Router({ mergeParams: true });

ownerBusinessStaffRouter.get("/",  BusinessStaffController.getStaffByBusiness);
ownerBusinessStaffRouter.post(
  "/",
  uploadSingle, handleMulterError,
  validateRequestBody(createStaffSchema),
  BusinessStaffController.createStaff,
);

export const ownerLeaveRouter = Router();

ownerLeaveRouter.get("/", BusinessStaffController.getLeaveRequests);
ownerLeaveRouter.patch(
  "/:leaveId",
  validateRequestBody(processLeaveSchema),
  BusinessStaffController.processLeave,
);