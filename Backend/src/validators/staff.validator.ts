import { z } from "zod";

export const updateStaffProfileSchema = z
    .object({
        bio: z
        .string()
        .max(500, "Bio cannot exceed 500 characters.")
        .optional(),

        experience_years: z
        .number()
        .int("Experience years must be a whole number.")
        .min(0, "Experience years cannot be negative.")
        .max(60, "Experience years seems too high.")
        .optional(),
    })
    .strict()
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message:
                "At least one field must be provided (bio, experience_years, or avatar file).",
        }
    );