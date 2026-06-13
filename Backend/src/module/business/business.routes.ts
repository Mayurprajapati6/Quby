/**
 * Business routes — now accessible by OWNER role (not BUSINESS role).
 * Owner passes ?businessId= or :businessId in route params.
 * The /business prefix is kept for backward compat; middleware resolves businessId.
 */
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";

import { BusinessController } from "./business.controller";
import { businessStaffRouter } from "./staff/business-staff.routes";
import { businessLeaveRouter } from "./leave/business-leave.routes";
import { businessBookingsRouter } from "./bookings/business-bookings.routes";
import { businessReviewsRouter } from "./reviews/business-reviews.routes";
import { businessTodayRouter } from "./today/business-today.routes";
import { businessDashboardRouter } from "./dashboard/business-dashboard.routes";
import { businessNotificationsRouter } from "./notifications/business-notifications.routes";

export const businessRouter = Router();

businessRouter.use(authenticate);
// Owner accesses business management routes via their JWT
// (BUSINESS role removed — no separate salon PC login)
businessRouter.use(authorizeRoles("OWNER"));

// KEY FIX: If ?businessId= is supplied (owner accessing a specific business portal),
// override req.user.businessId so every downstream controller gets the right business.
businessRouter.use((req: any, _res, next) => {
  const qbId = (req.query.businessId ?? req.headers["x-business-id"] ?? null) as string | null;
  if (qbId && req.user) {
    req.user.businessId = qbId;
  }
  req.businessId = qbId ?? req.user?.businessId ?? null;
  next();
});

businessRouter.post("/logout", BusinessController.logout);
businessRouter.get("/profile", BusinessController.getProfile);
businessRouter.get("/services", BusinessController.getServices);
businessRouter.get("/schedule", BusinessController.getSchedule);
businessRouter.get("/holidays", BusinessController.getHolidays);

businessRouter.use("/staff",         businessStaffRouter);
businessRouter.use("/leave",         businessLeaveRouter);
businessRouter.use("/bookings",      businessBookingsRouter);
businessRouter.use("/reviews",       businessReviewsRouter);
businessRouter.use("/today",         businessTodayRouter);
businessRouter.use("/dashboard",     businessDashboardRouter);
businessRouter.use("/notifications", businessNotificationsRouter);
// /wallet and /escrow routes removed
