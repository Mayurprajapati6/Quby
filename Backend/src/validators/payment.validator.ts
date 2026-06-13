import { z } from "zod";

export const createPaymentOrderSchema = z.object({
  booking_id: z
    .string({ required_error: "booking_id is required." })
    .uuid("booking_id must be a valid UUID."),
});

export const verifyPaymentSchema = z.object({
  booking_id: z
    .string({ required_error: "booking_id is required." })
    .uuid("booking_id must be a valid UUID."),

  razorpay_order_id: z
    .string({ required_error: "razorpay_order_id is required." })
    .min(1),

  razorpay_payment_id: z
    .string({ required_error: "razorpay_payment_id is required." })
    .min(1),

  razorpay_signature: z
    .string({ required_error: "razorpay_signature is required." })
    .min(1),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
