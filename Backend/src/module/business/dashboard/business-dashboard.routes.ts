import { Router } from "express";
import { BusinessDashboardController } from "./business-dashboard.controller";

export const businessDashboardRouter = Router();

businessDashboardRouter.get("/", BusinessDashboardController.getDashboard);
