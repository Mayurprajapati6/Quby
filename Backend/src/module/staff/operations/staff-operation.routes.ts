import { Router } from "express";
import { StaffOperationController } from "./staff-operation.controller";
import { validateRequestBody } from "../../../validators";
import { requestLeaveSchema } from "../../../validators/staff-leave.validator";

export const staffOperationRouter = Router();

staffOperationRouter.get("/leave", StaffOperationController.getLeaves);

staffOperationRouter.post(
  "/leave",
  validateRequestBody(requestLeaveSchema),
  StaffOperationController.requestLeave,
);

staffOperationRouter.delete("/leave/:leaveId", StaffOperationController.cancelLeave);
