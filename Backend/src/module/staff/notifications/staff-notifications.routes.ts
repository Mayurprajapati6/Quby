import { Router } from "express";
import { StaffNotificationsController } from "./staff-notifications.controller";

export const staffNotificationsRouter = Router();

staffNotificationsRouter.get("/", StaffNotificationsController.getNotifications);
staffNotificationsRouter.patch("/read-all", StaffNotificationsController.markAllRead);
staffNotificationsRouter.patch("/:id/read", StaffNotificationsController.markRead);
