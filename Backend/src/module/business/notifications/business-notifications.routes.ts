import { Router } from "express";
import { BusinessNotificationsController } from "./business-notifications.controller";

export const businessNotificationsRouter = Router();

businessNotificationsRouter.get("/", BusinessNotificationsController.getNotifications);

businessNotificationsRouter.patch("/read-all", BusinessNotificationsController.markAllRead);

businessNotificationsRouter.patch("/:id/read", BusinessNotificationsController.markRead);
