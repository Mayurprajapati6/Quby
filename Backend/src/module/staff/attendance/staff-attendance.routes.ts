import { Router } from "express";
import { StaffAttendanceController } from "./staff-attendance.controller";

export const staffAttendanceRouter = Router();

staffAttendanceRouter.get("/", StaffAttendanceController.getAttendance);
