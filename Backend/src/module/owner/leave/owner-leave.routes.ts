import { Router } from "express";
import { OwnerLeaveController } from "./owner-leave.controller";
import { validateRequestBody } from "../../../validators";
import { processLeaveSchema } from "../../../validators/owner.validator";

export const ownerLeaveRouter = Router();

ownerLeaveRouter.get("/", OwnerLeaveController.getLeaveRequests);

ownerLeaveRouter.patch(
  "/:leaveId",
  validateRequestBody(processLeaveSchema),
  OwnerLeaveController.processLeave,
);
