import { Router } from "express";
import { OwnerHolidayController } from "./owner-holiday.controller";
import { validateRequestBody } from "../../../validators";
import {
  createHolidaySchema,
  updateHolidaySchema,
} from "../../../validators/schedule.validator";

export const ownerHolidayRouter = Router({ mergeParams: true });

ownerHolidayRouter.get("/", OwnerHolidayController.getHolidays);

ownerHolidayRouter.post(
  "/",
  validateRequestBody(createHolidaySchema),
  OwnerHolidayController.createHoliday,
);

ownerHolidayRouter.patch(
  "/:holidayId",
  validateRequestBody(updateHolidaySchema),
  OwnerHolidayController.updateHoliday,
);

ownerHolidayRouter.delete("/:holidayId", OwnerHolidayController.deleteHoliday);
