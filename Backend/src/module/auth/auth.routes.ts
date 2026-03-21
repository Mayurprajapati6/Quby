import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
} from "../../middlewares/rateLimiter.middleware";
import { validateRequestBody } from "../../validators";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  staffSetupSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from "../../validators/auth.validator";

export const authRouter = Router();

authRouter.post(
  "/register",
  registerLimiter,
  validateRequestBody(registerSchema),
  AuthController.register,
);

authRouter.post(
  "/login",
  loginLimiter,
  validateRequestBody(loginSchema),
  AuthController.login,
);

authRouter.post(
  "/refresh",
  validateRequestBody(refreshTokenSchema),
  AuthController.refresh,
);

authRouter.post("/logout", AuthController.logout);

authRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  validateRequestBody(forgotPasswordSchema),
  AuthController.forgotPassword,
);

authRouter.post(
  "/reset-password",
  passwordResetLimiter,
  validateRequestBody(resetPasswordSchema),
  AuthController.resetPassword,
);

authRouter.post(
  "/staff-setup",
  validateRequestBody(staffSetupSchema),
  AuthController.staffSetup,
);

authRouter.patch(
  "/change-password",
  authenticate,
  validateRequestBody(changePasswordSchema),
  AuthController.changePassword,
);

authRouter.delete(
  "/account",
  authenticate,
  validateRequestBody(deleteAccountSchema),
  AuthController.deleteAccount,
);
