import express from "express";
import { AdminController } from "./admin.controller";
import { validateRequestBody } from "../../validators";
import { updateAdminProfileSchema } from "../../validators/admin.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";

import platformServicesRouter    from "./platform-services/platform-services.routes";
import businessVerificationRouter from "./business-verification/Business-verification.routes";

const router = express.Router();

router.use(authenticate, authorizeRoles("ADMIN"));

router.get("/profile", AdminController.getProfile);
router.put("/profile", validateRequestBody(updateAdminProfileSchema), AdminController.updateProfile);

router.use("/platform-services",      platformServicesRouter);
router.use("/business-verification",  businessVerificationRouter);

export default router;