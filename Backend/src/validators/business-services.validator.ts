import { z } from "zod";

export const addBusinessServiceSchema = z.object({
  platform_service_id: z
    .string({ required_error: "platform_service_id is required." })
    .uuid("platform_service_id must be a valid UUID."),
  price: z
    .number({ required_error: "price is required." })
    .int()
    .min(100, "Price must be at least ₹1 (100 paise)."),
  discounted_price: z
    .number()
    .int()
    .min(0, "Discounted price cannot be negative.")
    .optional(),
  is_featured: z.boolean().optional().default(false),
});

export const updateBusinessServiceSchema = z
  .object({
    price:            z.number().int().min(100).optional(),
    discounted_price: z.number().int().min(0).nullable().optional(),
    is_featured:      z.boolean().optional(),
    is_active:        z.boolean().optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field must be provided.",
  });

export type AddBusinessServiceInput = z.infer<typeof addBusinessServiceSchema>;
export type UpdateBusinessServiceInput = z.infer<typeof updateBusinessServiceSchema>;
