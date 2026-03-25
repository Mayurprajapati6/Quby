import { Router } from "express";
import { StaffLeaveController } from "./staff-leave.controller";
import { validateRequestBody } from "../../../validators";
import { requestLeaveSchema } from "../../../validators/staff-leave.validator";

export const staffLeaveRouter = Router();

staffLeaveRouter.get("/", StaffLeaveController.getLeaveRequests);

staffLeaveRouter.post(
  "/",
  validateRequestBody(requestLeaveSchema),
  StaffLeaveController.requestLeave,
);

staffLeaveRouter.delete("/:id", StaffLeaveController.cancelLeave);
