import { Router } from "express";
import { StaffDashboardController }  from "./staff-dashboard.controller";

export const staffDashboardRouter = Router();

staffDashboardRouter.get("/", StaffDashboardController.getDashboard);

