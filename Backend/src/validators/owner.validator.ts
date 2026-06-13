import { z } from "zod";

export const updateOwnerProfileSchema = z
  .object({
    name:          z.string().min(1).max(100).optional(),
    phone:         z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number.").optional(),
    city:          z.string().max(100).optional(),
    state:         z.string().max(100).optional(),
    address_line1: z.string().max(255).optional(),
    address_line2: z.string().max(255).optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field is required.",
  });

export const processLeaveSchema = z
  .object({
    action:           z.enum(["APPROVED", "REJECTED"]),
    rejection_reason: z.string().max(500).optional(),
  })
  .refine(
    d => d.action === "APPROVED" || !!d.rejection_reason,
    {
      message: "rejection_reason is required when rejecting a leave.",
      path:    ["rejection_reason"],
    },
  );

export type UpdateOwnerProfileInput = z.infer<typeof updateOwnerProfileSchema>;
export type ProcessLeaveInput = z.infer<typeof processLeaveSchema>;
