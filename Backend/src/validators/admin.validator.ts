import { z } from "zod";

export const updateAdminProfileSchema = z
  .object({
    name:          z.string().min(2).max(100).optional(),
    phone:         z.string().max(20).optional(),
    city:          z.string().max(100).optional(),
    state:         z.string().max(100).optional(),
    address_line1: z.string().max(255).optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field is required.",
  });

export const suspendSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters.").max(500),
});

export const rejectVerificationSchema = z.object({
  reason: z
    .string()
    .min(10, "Rejection reason must be at least 10 characters.")
    .max(500),
});

export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>;
export type SuspendInput = z.infer<typeof suspendSchema>;
export type RejectVerificationInput = z.infer<typeof rejectVerificationSchema>;
