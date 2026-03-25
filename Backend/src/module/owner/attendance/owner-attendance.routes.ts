import { Router } from "express";
import { OwnerAttendanceController } from "./owner-attendance.controller";

export const ownerAttendanceRouter = Router();

ownerAttendanceRouter.get("/", OwnerAttendanceController.getDailyAttendance);
ownerAttendanceRouter.get("/staff/:id", OwnerAttendanceController.getStaffAttendance);
