import { Router } from "express";
import { BusinessStaffController } from "./business-staff.controller";

export const businessStaffRouter = Router();

businessStaffRouter.get("/", BusinessStaffController.getStaffList);
businessStaffRouter.get("/:staffId", BusinessStaffController.getStaffDetail);
businessStaffRouter.get("/:staffId/leaves", BusinessStaffController.getStaffLeaves);
businessStaffRouter.get("/:staffId/attendance", BusinessStaffController.getStaffAttendance);
