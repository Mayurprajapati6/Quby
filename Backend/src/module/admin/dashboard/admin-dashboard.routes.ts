import { Router } from "express";
import { AdminDashboardController } from "./admin-dashboard.controller";

export const adminDashboardRouter = Router();

adminDashboardRouter.get("/", AdminDashboardController.getDashboard);
