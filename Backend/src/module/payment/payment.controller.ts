import { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../middlewares/types";
import { PaymentService } from "./payment.service";
import { successResponse } from "../../utils/helpers/response";
import logger from "../../config/logger.config";

export class PaymentController {

  static async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.userId;
      const data       = await PaymentService.createOrder(req.body.booking_id, customerId);
      res.status(201).json(successResponse(data, "Order created."));
    } catch (err) { next(err); }
  }

  static async verifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await PaymentService.verifyPayment({
        booking_id:          req.body.booking_id,
        razorpay_order_id:   req.body.razorpay_order_id,
        razorpay_payment_id: req.body.razorpay_payment_id,
        razorpay_signature:  req.body.razorpay_signature,
      });
      res.json(successResponse(data, "Payment verified."));
    } catch (err) { next(err); }
  }

  // CRITICAL: Return 500 on non-signature errors so Razorpay retries
  static async handleWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      await PaymentService.handleWebhook(req.body as Buffer, signature);
      res.status(200).json({ status: "ok" });
    } catch (err: any) {
      if (err?.message?.includes("Invalid webhook signature")) {
        // Invalid signature — do not retry, always 200
        logger.warn("[Webhook] Invalid signature received");
        res.status(200).json({ status: "ok" });
      } else {
        // Transient error — return 500 so Razorpay retries
        logger.error("[Webhook] Processing error:", err);
        res.status(500).json({ status: "error" });
      }
    }
  }
}
