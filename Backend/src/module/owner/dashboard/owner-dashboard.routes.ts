import { Router } from "express";
import { OwnerDashboardController } from "./owner-dashboard.controller";

export const ownerDashboardRouter = Router();

ownerDashboardRouter.get("/", OwnerDashboardController.getDashboard);
