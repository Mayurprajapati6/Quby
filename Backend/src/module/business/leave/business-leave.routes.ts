import { Router } from "express";
import { BusinessLeaveController } from "./business-leave.controller";

export const businessLeaveRouter = Router();

businessLeaveRouter.get("/holidays", BusinessLeaveController.getHolidays);
businessLeaveRouter.get("/staff", BusinessLeaveController.getLeaves);
