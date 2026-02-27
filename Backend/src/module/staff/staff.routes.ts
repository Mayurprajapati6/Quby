import express from "express";
import { StaffController } from "./staff.controller";
import { validateRequestBody } from "../../validators";
import { updateStaffProfileSchema } from "../../validators/staff.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";

const router = express.Router();

router.use(authenticate, authorizeRoles("STAFF"));

router.get(
  "/profile",
  StaffController.getProfile
);

router.patch(
  "/profile",
  validateRequestBody(updateStaffProfileSchema),
  StaffController.updateProfile
);

export default router;