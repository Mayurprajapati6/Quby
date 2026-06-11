import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";
import { validateRequestBody } from "../../validators";
import {
  updateStaffProfileSchema,
  deleteStaffAccountSchema,
} from "../../validators/staff.validator";
import { uploadSingle, handleMulterError } from "../../utils/helpers/multer";
import { StaffController } from "./staff.controller";
import { staffQueueRouter } from "./queue/staff-queue.routes";
import { staffOperationRouter } from "./operations/staff-operation.routes";
import { staffBookingsRouter } from "./bookings/staff-bookings.routes";
import { staffReviewsRouter }  from "./reviews/staff-reviews.routes";
import { staffHolidayRouter } from "./holiday/staff-holiday.routes";
import { staffQrLogRouter } from "./qr-log/staff-qr-log.routes";
import { staffDashboardRouter } from "./dashboard/staff-dashboard.routes";
import { staffNotificationsRouter } from "./notifications/staff-notifications.routes";
import { staffLeaveRouter } from "./leave/staff-leave.routes";

export const staffRouter = Router();

staffRouter.use(authenticate);
staffRouter.use(authorizeRoles("STAFF"));

staffRouter.post("/logout", StaffController.logout);

staffRouter.get("/profile", StaffController.getProfile);

staffRouter.patch(
  "/profile",
  uploadSingle("avatar"),
  handleMulterError,
  validateRequestBody(updateStaffProfileSchema),
  StaffController.updateProfile,
);
staffRouter.delete(
  "/account",
  validateRequestBody(deleteStaffAccountSchema),
  StaffController.deleteAccount,
);

staffRouter.use("/queue", staffQueueRouter);
staffRouter.use("/operations", staffOperationRouter);
staffRouter.use("/bookings", staffBookingsRouter);
staffRouter.use("/reviews", staffReviewsRouter);
staffRouter.use("/holiday", staffHolidayRouter);
staffRouter.use("/qr-log", staffQrLogRouter);
staffRouter.use("/dashboard", staffDashboardRouter);
staffRouter.use("/leave", staffLeaveRouter);
staffRouter.use("/notifications", staffNotificationsRouter);
