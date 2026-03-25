import { Router } from "express";
import { OwnerNotificationsController } from "./owner-notifications.controller";

export const ownerNotificationsRouter = Router();

ownerNotificationsRouter.get("/", OwnerNotificationsController.getNotifications);
ownerNotificationsRouter.patch("/read-all", OwnerNotificationsController.markAllRead);
ownerNotificationsRouter.patch("/:id/read", OwnerNotificationsController.markRead);
