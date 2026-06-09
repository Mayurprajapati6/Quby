import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";
import { ROLES } from "../../constants/roles";
import { uploadSingle, handleMulterError } from "../../utils/helpers/multer";
import { validateRequestBody } from "../../validators";
import { updateOwnerProfileSchema } from "../../validators/owner.validator";
import { OwnerController } from "./owner.controller";
import { ownerBusinessRouter } from "./business/business.routes";
import { ownerStaffRouter } from "./business-staff/business-staff.routes";
import { ownerLeaveRouter } from "./leave/owner-leave.routes";
import { ownerDashboardRouter } from "./dashboard/owner-dashboard.routes";
import { ownerBookingsRouter } from "./bookings/owner-bookings.routes";
import { ownerReviewsRouter } from "./reviews/owner-reviews.routes";
import { staffDetailRouter } from "./staff-detail/staff-detail.routes";
import { PlatformServicesRepository } from "../../module/admin/platform-services/platform-services.repository";
import { successResponse } from "../../utils/helpers/response";

export const ownerRouter = Router();

ownerRouter.use(authenticate);
ownerRouter.use(authorizeRoles(ROLES.OWNER));

ownerRouter.get("/profile", OwnerController.getProfile);
ownerRouter.patch(
  "/profile",
  uploadSingle("avatar"),
  handleMulterError,
  validateRequestBody(updateOwnerProfileSchema),
  OwnerController.updateProfile,
);

ownerRouter.post("/logout", OwnerController.logout);

ownerRouter.patch("/notifications/read-all", OwnerController.markAllNotificationsRead);
ownerRouter.get("/notifications",             OwnerController.getNotifications);
ownerRouter.patch("/notifications/:id/read",  OwnerController.markNotificationRead);

// ── Platform services — read-only for owners to build their service menu ──
ownerRouter.get("/platform-services", async (req: any, res, next) => {
  try {
    const { service_for, is_active } = req.query as Record<string, string>;
    const services = await PlatformServicesRepository.findAll({
      service_for: service_for as "MEN" | "UNISEX" | undefined,
      is_active:   is_active !== undefined ? is_active === "true" : true, // default: only active
    });
    res.json(successResponse(services));
  } catch (err) { next(err); }
});

ownerRouter.use("/businesses",   ownerBusinessRouter);
ownerRouter.use("/staff",        ownerStaffRouter);
ownerRouter.use("/leave",        ownerLeaveRouter);
ownerRouter.use("/dashboard",    ownerDashboardRouter);
ownerRouter.use("/bookings",     ownerBookingsRouter);
ownerRouter.use("/reviews",      ownerReviewsRouter);
ownerRouter.use("/staff-detail", staffDetailRouter);
