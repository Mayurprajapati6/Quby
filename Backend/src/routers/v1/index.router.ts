import { Router } from "express";
import {
  globalLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  exploreLimiter,
} from "../../middlewares/rateLimiter.middleware";

import { authRouter } from "../../module/auth/auth.routes";
import { customerRouter } from "../../module/customer/customer.routes";
import { explorePublicRouter } from "../../module/customer/explore/explore.public.routes";
import { businessDetailPublicRouter } from "../../module/customer/business-detail/business-detail.public.routes";
import { ownerRouter } from "../../module/owner/owner.routes";
import { businessRouter } from "../../module/business/business.routes";
import { staffRouter } from "../../module/staff/staff.routes";
import { adminRouter } from "../../module/admin/admin.routes";
import { paymentRouter } from "../../module/payment/payment.routes";

const v1Router = Router();
v1Router.use(globalLimiter);

v1Router.use("/auth/login",           loginLimiter);
v1Router.use("/auth/register",        registerLimiter);
v1Router.use("/auth/forgot-password", passwordResetLimiter);
v1Router.use("/auth/reset-password",  passwordResetLimiter);
v1Router.use("/auth", authRouter);

//  Public routes  
v1Router.use("/explore",    exploreLimiter, explorePublicRouter);         
v1Router.use("/businesses", exploreLimiter, businessDetailPublicRouter);  

// Role-protected modules 
v1Router.use("/customer", customerRouter);
v1Router.use("/owner",    ownerRouter);
v1Router.use("/business", businessRouter);
v1Router.use("/staff",    staffRouter);
v1Router.use("/admin",    adminRouter);
v1Router.use("/payment",  paymentRouter);

// Health check 
v1Router.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status:    "ok",
      version:   "v1",
      timestamp: new Date().toISOString(),
      uptime:    process.uptime(),
    },
  });
});

export default v1Router;
