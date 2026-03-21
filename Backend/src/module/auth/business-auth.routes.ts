import { Router, type RequestHandler } from "express";
import { validateRequestBody } from "../../validators";
import {
  createBusinessAccountSchema,
  resetBusinessPasswordSchema,
  setBusinessStatusSchema,
} from "../../validators/auth.validator";
import { BusinessAuthController } from "./business-auth.controller";

export const businessAccountRouter = Router({ mergeParams: true });

businessAccountRouter.post(
  "/",
  validateRequestBody(createBusinessAccountSchema),
  BusinessAuthController.createAccount as RequestHandler
);

businessAccountRouter.get(
  "/",
  BusinessAuthController.getAccountInfo as RequestHandler
);

businessAccountRouter.patch(
  "/password",
  validateRequestBody(resetBusinessPasswordSchema),
  BusinessAuthController.resetPassword as RequestHandler
);

businessAccountRouter.patch(
  "/status",
  validateRequestBody(setBusinessStatusSchema),
  BusinessAuthController.setAccountStatus as RequestHandler
);

businessAccountRouter.delete(
  "/",
  BusinessAuthController.deleteAccount as RequestHandler
);
