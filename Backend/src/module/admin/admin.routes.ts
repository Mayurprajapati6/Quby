import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";
import { updateAdminProfileSchema, validateRequestBody } from "../../validators";
import { uploadSingle, handleMulterError } from "../../utils/helpers/multer";

import { AdminController } from "./admin.controller";
import { adminUsersRouter } from "./users/admin-users.routes";
import { adminBusinessesRouter } from "./businesses/admin-businesses.routes";
import { adminVerificationRouter } from "./verification/admin-verification.routes";
import { adminDashboardRouter } from "./dashboard/admin-dashboard.routes";
import { platformServicesRouter } from "./platform-services/platform-services.routes";


export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(authorizeRoles("ADMIN"));

adminRouter.post("/logout", AdminController.logout);

adminRouter.get("/profile", AdminController.getProfile);
adminRouter.patch(
  "/profile",
  uploadSingle("avatar"),
  handleMulterError,
  validateRequestBody(updateAdminProfileSchema),
  AdminController.updateProfile,
);

adminRouter.use("/users", adminUsersRouter);
adminRouter.use("/businesses", adminBusinessesRouter);
adminRouter.use("/verification", adminVerificationRouter);
adminRouter.use("/dashboard", adminDashboardRouter);
adminRouter.use("/platform-services", platformServicesRouter);
