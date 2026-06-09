import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";
import { ROLES } from "../../constants/roles";
import { uploadSingle, handleMulterError } from "../../utils/helpers/multer";
import { validateRequestBody } from "../../validators";

import { CustomerController } from "./customer.controller";
import {
  updateCustomerProfileSchema,
  deleteAccountSchema,
} from "./customer.validator";

import { customerDashboardRouter } from "./dashboard/customer-dashboard.routes";
import { exploreRouter } from "./explore/explore.routes";
import { businessDetailRouter } from "./business-detail/business-detail.routes";
import { bookingRouter } from "./booking/booking.routes";
import { reviewRouter } from "../review/review.routes";

export const customerRouter = Router();

customerRouter.use(authenticate);
customerRouter.use(authorizeRoles(ROLES.CUSTOMER));

customerRouter.get(
  "/profile",
  CustomerController.getProfile,
);

customerRouter.patch(
  "/profile",
  uploadSingle,
  handleMulterError,
  validateRequestBody(updateCustomerProfileSchema),
  CustomerController.updateProfile,
);

customerRouter.delete(
  "/account",
  validateRequestBody(deleteAccountSchema),
  CustomerController.deleteAccount,
);

customerRouter.post(
  "/logout",
  CustomerController.logout,
);

customerRouter.get(
  "/notifications",
  CustomerController.getNotifications,
);

customerRouter.patch(
  "/notifications/read-all",
  CustomerController.markAllNotificationsRead,
);

customerRouter.patch(
  "/notifications/:id/read",
  CustomerController.markNotificationRead,
);

customerRouter.use("/dashboard",     customerDashboardRouter);
customerRouter.use("/booking",       bookingRouter);
customerRouter.use("/reviews",       reviewRouter);

customerRouter.use("/explore",       exploreRouter);
customerRouter.use("/business",      businessDetailRouter);
