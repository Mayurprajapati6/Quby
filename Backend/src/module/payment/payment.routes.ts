import express, { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/role.middleware';
import { ROLES } from '../../constants/roles';
import { validateRequestBody } from '../../validators';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
} from '../../validators/payment.validator';
import { PaymentController } from './payment.controller';
import {
  paymentOrderLimiter,
  paymentVerifyLimiter,
} from '../../middlewares/rateLimiter.middleware';
import { reqtrolRateLimiter } from '../../middlewares/reqtrol.middleware';

export const paymentRouter = Router();

paymentRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  PaymentController.handleWebhook,
);

paymentRouter.post(
  '/order',
  authenticate,
  authorizeRoles(ROLES.CUSTOMER),
  reqtrolRateLimiter('paymentOrderLimiter', paymentOrderLimiter),
  validateRequestBody(createPaymentOrderSchema),
  PaymentController.createOrder,
);

paymentRouter.post(
  '/verify',
  authenticate,
  authorizeRoles(ROLES.CUSTOMER),
  reqtrolRateLimiter('paymentVerifyLimiter', paymentVerifyLimiter),
  validateRequestBody(verifyPaymentSchema),
  PaymentController.verifyPayment,
);