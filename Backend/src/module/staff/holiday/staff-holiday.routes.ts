import { Router } from "express";
import { StaffHolidayController }  from "./staff-holiday.controller";

export const staffHolidayRouter = Router();

staffHolidayRouter.get("/", StaffHolidayController.getHolidays);
