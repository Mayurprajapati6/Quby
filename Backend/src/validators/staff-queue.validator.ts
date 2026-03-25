import { z } from "zod";

export const scanQrSchema = z.object({
  qr_code_id: z.string().min(1, "qr_code_id is required."),
});

export const scanBookingSchema = z.object({
  qr_id:       z.string().min(1, "qr_id is required."),
  scan_method: z.enum(["CAMERA", "MANUAL"]).optional(),
  client_time: z.string().datetime({ offset: true }).optional(),
});

export const completeServiceSchema = z.object({
  booking_id: z.string().uuid("booking_id must be a valid UUID."),
});

export const extendServiceSchema = z.object({
  booking_id:    z.string().uuid("booking_id must be a valid UUID."),
  extra_minutes: z
    .number({ required_error: "extra_minutes is required." })
    .int()
    .min(1,  "Minimum extension is 1 minute.")
    .max(60, "Maximum extension is 60 minutes."),
});

export const reportDelaySchema = z.object({
  booking_id:    z.string().uuid("booking_id must be a valid UUID."),
  delay_minutes: z
    .number({ required_error: "delay_minutes is required." })
    .int()
    .min(1,   "Minimum delay is 1 minute.")
    .max(120, "Maximum delay is 120 minutes."),
});

export type ScanQrInput = z.infer<typeof scanQrSchema>;
export type ScanBookingInput = z.infer<typeof scanBookingSchema>;
export type CompleteServiceInput = z.infer<typeof completeServiceSchema>;
export type ExtendServiceInput = z.infer<typeof extendServiceSchema>;
export type ReportDelayInput = z.infer<typeof reportDelaySchema>;
