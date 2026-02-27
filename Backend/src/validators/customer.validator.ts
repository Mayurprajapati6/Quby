import { z } from "zod";

const name   = z.string().min(2, "Name must be at least 2 characters.").max(100, "Name cannot exceed 100 characters.");
const phone  = z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits.");
const city   = z.string().min(2, "City must be at least 2 characters.");
const state  = z.string().min(2, "State must be at least 2 characters.");
const gender = z.enum(["MALE", "FEMALE", "OTHER"], {
  errorMap: () => ({ message: "Gender must be MALE, FEMALE, or OTHER." }),
});

export const updateCustomerProfileSchema = z
  .object({
    name:   name.optional(),
    phone:  phone.optional(),
    city:   city.optional(),
    state:  state.optional(),
    gender: gender.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  });