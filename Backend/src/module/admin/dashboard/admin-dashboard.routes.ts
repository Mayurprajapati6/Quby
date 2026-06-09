import { Router } from "express";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { AdminAnalyticsController } from "./admin-analytics.controller";

export const adminDashboardRouter = Router();

adminDashboardRouter.get("/", AdminDashboardController.getDashboard);
adminDashboardRouter.get("/analytics", AdminAnalyticsController.getAnalytics);
