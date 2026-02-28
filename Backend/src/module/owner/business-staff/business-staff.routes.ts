import express from "express";
import { BusinessStaffController } from "./business-staff.controller";
import { validateRequestBody } from "../../../validators";
import {
  createStaffSchema,
  updateStaffSchema,
  updateStaffServicesSchema,
  updateStaffScheduleSchema,
  leaveActionSchema,
} from "../../../validators/business-staff.validator";

const router = express.Router({ mergeParams: true });

router.get("/",BusinessStaffController.list);
router.post("/",validateRequestBody(createStaffSchema),BusinessStaffController.create);
router.get("/leaves",BusinessStaffController.getPendingLeaves);
router.get("/:staffId",BusinessStaffController.getOne);
router.patch("/:staffId",validateRequestBody(updateStaffSchema),BusinessStaffController.update);
router.delete("/:staffId",BusinessStaffController.deactivate);
router.put("/:staffId/services",validateRequestBody(updateStaffServicesSchema),BusinessStaffController.updateServices);
router.put("/:staffId/schedule",validateRequestBody(updateStaffScheduleSchema),BusinessStaffController.updateSchedule);
router.patch("/leaves/:leaveId",validateRequestBody(leaveActionSchema),BusinessStaffController.processLeave);

export default router;