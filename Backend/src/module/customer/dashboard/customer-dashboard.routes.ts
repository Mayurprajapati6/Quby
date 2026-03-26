import { Router } from "express";
import { CustomerDashboardController } from "./customer-dashboard.controller";

export const customerDashboardRouter = Router();

customerDashboardRouter.get("/", CustomerDashboardController.getDashboard);
