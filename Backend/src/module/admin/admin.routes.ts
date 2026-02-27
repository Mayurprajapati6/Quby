import express from "express";
import { AdminController } from "./admin.controller";
import { validateRequestBody } from "../../validators";
import { updateAdminProfileSchema } from "../../validators/admin.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";

const router = express.Router();

router.use(authenticate, authorizeRoles("ADMIN"));

router.get("/profile", AdminController.getProfile);

router.put(
  "/profile",
  validateRequestBody(updateAdminProfileSchema),
  AdminController.updateProfile
);

export default router;