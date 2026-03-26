import { z } from "zod";

export const suggestStaffSchema = z.object({
  business_id: z
    .string({ required_error: "business_id is required." })
    .uuid("business_id must be a valid UUID."),
  service_offering_ids: z
    .array(z.string().uuid("Each service_offering_id must be a valid UUID."))
    .min(1, "At least one service is required.")
    .max(10, "Cannot request more than 10 services at once."),
  service_date: z
    .string({ required_error: "service_date is required." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "service_date must be YYYY-MM-DD."),
});

export const checkAvailabilitySchema = z.object({
  business_id: z
    .string({ required_error: "business_id is required." })
    .uuid("business_id must be a valid UUID."),
  service_offering_ids: z
    .array(z.string().uuid("Each service_offering_id must be a valid UUID."))
    .min(1, "At least one service is required.")
    .max(10, "Cannot book more than 10 services at once."),
  service_date: z
    .string({ required_error: "service_date is required." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "service_date must be YYYY-MM-DD."),
  staff_id: z.string().uuid("staff_id must be a valid UUID.").optional(),
  mode: z.enum(["select", "random"]).default("select"),
});

export const createBookingSchema = z.object({
  reservation_token: z
    .string({ required_error: "reservation_token is required." })
    .min(1, "reservation_token cannot be empty."),
  selected_slot_idx: z.number().int().min(0).default(0),
  idempotency_key: z
    .string({ required_error: "idempotency_key is required." })
    .uuid("idempotency_key must be a valid UUID v4 — generate on the client before each request."),
  notes: z.string().max(500, "notes max 500 characters.").optional(),
});

export const cancelBookingSchema = z.object({
  cancellation_reason: z
    .string()
    .max(500, "Cancellation reason max 500 characters.")
    .optional(),
});

export const myBookingsQuerySchema = z.object({
  tab:   z.enum(["today", "upcoming", "completed", "cancelled", "no_show"]).default("upcoming"),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type SuggestStaffInput = z.infer<typeof suggestStaffSchema>;
export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type MyBookingsQueryInput = z.infer<typeof myBookingsQuerySchema>;
