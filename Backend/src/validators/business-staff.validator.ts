import { z } from "zod";

const DAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY",
  "FRIDAY", "SATURDAY", "SUNDAY",
] as const;

const TIME_RE = /^\d{2}:\d{2}$/;

export const createStaffSchema = z.object({
  name:             z.string().min(2).max(100),
  email:            z.string().email("Invalid email address."),
  phone:            z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number."),
  specialization:   z.string().max(100).optional(),
  experience_years: z.coerce.number().int().min(0).max(50).optional(),
  bio:              z.string().max(1000).optional(),

  services: z
    .array(z.object({
      service_offering_id: z.string().uuid("service_offering_id must be a UUID."),
      duration_minutes:    z.number().int().min(5).max(480),
      is_available:        z.boolean().optional().default(true),
    }))
    .optional(),

  schedule: z
    .array(z.object({
      day_of_week:  z.enum(DAYS),
      is_available: z.boolean(),
      start_time:   z.string().regex(TIME_RE, "Time must be HH:MM.").optional(),
      end_time:     z.string().regex(TIME_RE, "Time must be HH:MM.").optional(),
    }))
    .optional(),
});

export const updateStaffSchema = z
  .object({
    name:             z.string().min(2).max(100).optional(),
    phone:            z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number.").optional(),
    specialization:   z.string().max(100).optional(),
    experience_years: z.coerce.number().int().min(0).max(50).optional(),
    bio:              z.string().max(1000).optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field is required.",
  });

export const updateStaffServicesSchema = z.object({
  services: z
    .array(z.object({
      service_offering_id: z.string().uuid(),
      duration_minutes:    z.number().int().min(5).max(480),
      is_available:        z.boolean().optional().default(true),
    }))
    .min(1, "At least one service must be assigned."),
});

export const updateStaffScheduleSchema = z.object({
  schedule: z
    .array(z.object({
      day_of_week:  z.enum(DAYS),
      is_available: z.boolean(),
      start_time:   z.string().regex(TIME_RE, "Time must be HH:MM.").optional(),
      end_time:     z.string().regex(TIME_RE, "Time must be HH:MM.").optional(),
    }))
    .min(1)
    .max(7),
});

export const toggleStaffActiveSchema = z.object({
  is_active: z.boolean({ required_error: "is_active (boolean) is required." }),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type UpdateStaffServicesInput = z.infer<typeof updateStaffServicesSchema>;
export type UpdateStaffScheduleInput = z.infer<typeof updateStaffScheduleSchema>;
export type ToggleStaffActiveInput = z.infer<typeof toggleStaffActiveSchema>;
