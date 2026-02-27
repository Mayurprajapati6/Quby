import { z } from "zod";

export const updateStaffProfileSchema = z
  .object({
    bio: z
      .string()
      .trim()
      .min(1, "Bio cannot be empty.")
      .max(500, "Bio cannot exceed 500 characters.")
      .optional(),

    experience_years: z
      .coerce.number()
      .int("Experience years must be a whole number.")
      .min(0, "Experience years cannot be negative.")
      .max(60, "Experience years seems too high.")
      .optional(),

    avatar: z
      .string()
      .min(1, "Avatar cannot be empty.")
      .optional(),
  })
  .strict() 
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided." }
  );