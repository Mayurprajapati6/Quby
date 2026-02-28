import express from "express";
import { ScheduleController } from "./schedule.controller";
import { validateRequestBody } from "../../../validators";
import { updateScheduleSchema, createHolidaySchema } from "../../../validators/schedule.validator";

const router = express.Router({ mergeParams: true });

router.get( "/",ScheduleController.getSchedule);
router.patch("/",validateRequestBody(updateScheduleSchema),ScheduleController.updateSchedule);
router.get("/holidays",ScheduleController.getHolidays);
router.post("/holidays", validateRequestBody(createHolidaySchema),ScheduleController.createHoliday);
router.delete("/holidays/:holidayId",ScheduleController.deleteHoliday);

export default router;