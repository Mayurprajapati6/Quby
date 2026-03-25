import { Router } from "express";
import { StaffQueueController } from "./staff-queue.controller";
import { validateRequestBody } from "../../../validators";
import {
  scanQrSchema,
  completeServiceSchema,
  extendServiceSchema,
  reportDelaySchema,
} from "../../../validators/staff-queue.validator";
import { scanLimiter } from "../../../middlewares/rateLimiter.middleware";

export const staffQueueRouter = Router();

staffQueueRouter.get("/today", StaffQueueController.getTodayQueue);
staffQueueRouter.get("/:date", StaffQueueController.getQueueByDate);

staffQueueRouter.post(
  "/scan-qr",
  scanLimiter,
  validateRequestBody(scanQrSchema),
  StaffQueueController.scanQr,
);

staffQueueRouter.post(
  "/complete",
  validateRequestBody(completeServiceSchema),
  StaffQueueController.completeService,
);

staffQueueRouter.post(
  "/extend",
  validateRequestBody(extendServiceSchema),
  StaffQueueController.extendService,
);

staffQueueRouter.post(
  "/delay",
  validateRequestBody(reportDelaySchema),
  StaffQueueController.reportDelay,
);

staffQueueRouter.post(
  "/rebuild",
  StaffQueueController.rebuildQueue,
);