import { z } from "zod";

const name = z
  .string()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name cannot exceed 100 characters.");

export const updateAdminProfileSchema = z
  .object({
    name: name.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  });