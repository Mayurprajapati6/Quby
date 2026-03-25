import { Router } from "express";
import { ScheduleController } from "./schedule.controller";
import { validateRequestBody } from "../../../validators";
import {
  updateScheduleSchema,
  createHolidaySchema,
} from "../../../validators/schedule.validator";

export const scheduleRouter = Router({ mergeParams: true });

// Static paths before /:param
scheduleRouter.get("/holidays", ScheduleController.getHolidays);
scheduleRouter.post(
  "/holidays",
  validateRequestBody(createHolidaySchema),
  ScheduleController.createHoliday,
);
scheduleRouter.delete("/holidays/:holidayId", ScheduleController.deleteHoliday);

scheduleRouter.get("/", ScheduleController.getSchedule);
scheduleRouter.put(
  "/",
  validateRequestBody(updateScheduleSchema),
  ScheduleController.updateSchedule,
);
