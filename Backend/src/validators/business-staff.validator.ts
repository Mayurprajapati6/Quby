import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const phone     = z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits.");
const email     = z.string().email("Invalid email format.");

export const createStaffSchema = z.object({
  name:             z.string().min(2).max(100),
  email,
  phone,
  specialization:   z.string().max(200).optional(),
  experience_years: z.number().int().min(0).max(60).optional(),
  bio:              z.string().max(500).optional(),

  services: z
    .array(z.object({
      service_offering_id: z.string().uuid(),
      duration_minutes:    z.number().int().min(5).max(480),
    }))
    .min(1, "At least one service must be assigned."),

  schedule: z
    .array(z.object({
      day_of_week:  z.enum(["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"]),
      is_available: z.boolean(),
      start_time:   z.string().regex(timeRegex).optional(),
      end_time:     z.string().regex(timeRegex).optional(),
    }))
    .max(7)
    .optional(),
});

export const updateStaffSchema = z
  .object({
    name:             z.string().min(2).max(100).optional(),
    phone,
    specialization:   z.string().max(200).optional(),
    experience_years: z.number().int().min(0).max(60).optional(),
    bio:              z.string().max(500).optional(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided.",
  });

export const updateStaffServicesSchema = z.object({
  services: z
    .array(z.object({
      service_offering_id: z.string().uuid(),
      duration_minutes:    z.number().int().min(5).max(480),
      is_available:        z.boolean().optional(),
    }))
    .min(1),
});

export const updateStaffScheduleSchema = z.object({
  schedule: z
    .array(z.object({
      day_of_week:  z.enum(["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"]),
      is_available: z.boolean(),
      start_time:   z.string().regex(timeRegex).optional(),
      end_time:     z.string().regex(timeRegex).optional(),
    }))
    .min(1)
    .max(7),
});

export const leaveActionSchema = z.object({
  action:           z.enum(["APPROVED", "REJECTED"]),
  rejection_reason: z.string().min(5).max(500).optional(),
}).refine(
  (d) => d.action === "APPROVED" || !!d.rejection_reason,
  { message: "Rejection reason is required when rejecting a leave.", path: ["rejection_reason"] }
);