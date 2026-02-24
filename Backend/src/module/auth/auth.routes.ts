import express from "express";
import { AuthController } from "./auth.controller";
import { validateRequestBody } from "../../validators";
import {
  signupSchema,
  loginSchema,
  staffSetupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from "../../validators/auth.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
} from "../../middlewares/rateLimiter.middleware";

const router = express.Router();

router.post(
  "/signup",
  registerLimiter,
  validateRequestBody(signupSchema),
  AuthController.signup
);

router.post(
  "/login",
  loginLimiter,
  validateRequestBody(loginSchema),
  AuthController.login
);

router.post(
  "/staff/setup",
  validateRequestBody(staffSetupSchema),
  AuthController.staffSetup
);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  validateRequestBody(forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  validateRequestBody(resetPasswordSchema),
  AuthController.resetPassword
);

router.post("/refresh", AuthController.refresh);

router.post("/logout", AuthController.logout);

router.post(
  "/change-password",
  authenticate,
  validateRequestBody(changePasswordSchema),
  AuthController.changePassword
);

router.post("/logout-all", authenticate, AuthController.logoutAll);

router.delete(
  "/account",
  authenticate,
  validateRequestBody(deleteAccountSchema),
  AuthController.deleteAccount
);

export default router;