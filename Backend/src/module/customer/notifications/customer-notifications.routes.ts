import { Router } from "express";
import { CustomerNotificationsController } from "./customer-notifications.controller";

export const customerNotificationsRouter = Router();

customerNotificationsRouter.get("/", CustomerNotificationsController.getNotifications);
customerNotificationsRouter.patch("/read-all", CustomerNotificationsController.markAllRead);
customerNotificationsRouter.patch("/:id/read", CustomerNotificationsController.markRead);
