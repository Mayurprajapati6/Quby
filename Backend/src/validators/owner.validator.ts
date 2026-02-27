import { z } from "zod";

const name  = z.string().min(2, "Name must be at least 2 characters.").max(100, "Name cannot exceed 100 characters.");
const phone = z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits.");
const city  = z.string().min(2, "City must be at least 2 characters.");
const state = z.string().min(2, "State must be at least 2 characters.");

export const updateOwnerProfileSchema = z
  .object({
    name:   name.optional(),
    phone:  phone.optional(),
    city:   city.optional(),
    state:  state.optional(),
    avatar: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  });