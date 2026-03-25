import { z } from "zod";

export const updateStaffProfileSchema = z
  .object({
    name:             z.string().min(2).max(100).optional(),
    phone:            z.string().max(20).optional(),
    bio:              z.string().max(2000).optional(),
    specialization:   z.string().max(200).optional(),
    experience_years: z.coerce.number().int().min(0).max(60).optional(),
    city:             z.string().max(100).optional(),
    state:            z.string().max(100).optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field must be provided.",
  });

export const deleteStaffAccountSchema = z.object({
  password: z.string().min(1, "password is required."),
});

export type UpdateStaffProfileInput = z.infer<typeof updateStaffProfileSchema>;
