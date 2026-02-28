import { z } from "zod";

export const addBusinessServiceSchema = z.object({
  platform_service_id: z.string().uuid("Invalid platform service ID."),
  price:               z.number().int().min(1, "Price must be at least 1 paisa."),
  discounted_price:    z.number().int().min(1).optional(),
  is_featured:         z.boolean().optional(),
});

export const updateBusinessServiceSchema = z
  .object({
    price:            z.number().int().min(1).optional(),
    discounted_price: z.number().int().min(1).optional(),
    is_active:        z.boolean().optional(),
    is_featured:      z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided.",
  });