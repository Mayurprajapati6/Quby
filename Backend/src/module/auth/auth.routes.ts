/**
 * auth.routes.ts  (FIXED)
 *
 * Old pattern (broken):  loginLimiter, reqtrolMiddleware
 *   → blocked requests short-circuit at loginLimiter; reqtrolMiddleware never runs.
 *
 * New pattern (fixed):   reqtrolRateLimiter('loginLimiter', loginLimiter)
 *   → analytics fires INSIDE the wrapper for BOTH allowed and blocked outcomes.
 */

import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
} from '../../middlewares/rateLimiter.middleware';
import { reqtrolRateLimiter } from '../../middlewares/reqtrol.middleware';
import { validateRequestBody } from '../../validators';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  staffSetupSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from '../../validators/auth.validator';

export const authRouter = Router();

authRouter.post(
  '/register',
  reqtrolRateLimiter('registerLimiter', registerLimiter),
  validateRequestBody(registerSchema),
  AuthController.register,
);

authRouter.post(
  '/login',
  reqtrolRateLimiter('loginLimiter', loginLimiter),
  validateRequestBody(loginSchema),
  AuthController.login,
);

authRouter.post(
  '/refresh',
  validateRequestBody(refreshTokenSchema),
  AuthController.refresh,
);

authRouter.post('/logout', AuthController.logout);

authRouter.post(
  '/forgot-password',
  reqtrolRateLimiter('passwordResetLimiter', passwordResetLimiter),
  validateRequestBody(forgotPasswordSchema),
  AuthController.forgotPassword,
);

authRouter.post(
  '/reset-password',
  reqtrolRateLimiter('passwordResetLimiter', passwordResetLimiter),
  validateRequestBody(resetPasswordSchema),
  AuthController.resetPassword,
);

authRouter.post(
  '/staff-setup',
  validateRequestBody(staffSetupSchema),
  AuthController.staffSetup,
);

authRouter.patch(
  '/change-password',
  authenticate,
  validateRequestBody(changePasswordSchema),
  AuthController.changePassword,
);

authRouter.delete(
  '/account',
  authenticate,
  validateRequestBody(deleteAccountSchema),
  AuthController.deleteAccount,
);