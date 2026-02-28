import express from "express";
import { OwnerController } from "./owner.controller";
import { validateRequestBody } from "../../validators";
import { updateOwnerProfileSchema } from "../../validators/owner.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";

// Phase 2 sub-routers
import businessRouter        from "./business/business.route";
import businessServicesRouter from "./business-services/business-services.routes";
import scheduleRouter        from "./schedule/schedule.routes";
import BusinessStaffRouter   from "./business-staff/business-staff.routes"

const router = express.Router();

router.use(authenticate, authorizeRoles("OWNER"));

// Profile
router.get("/profile", OwnerController.getProfile);
router.put("/profile", validateRequestBody(updateOwnerProfileSchema), OwnerController.updateProfile);

// Phase 2: Business management
router.use("/businesses", businessRouter);

// Phase 2: Per-business sub-resources (services, schedule, staff)
router.use("/businesses/:businessId/services",  businessServicesRouter);
router.use("/businesses/:businessId/schedule",  scheduleRouter);
router.use("/businesses/:businessId/staff",     BusinessStaffRouter);

export default router;