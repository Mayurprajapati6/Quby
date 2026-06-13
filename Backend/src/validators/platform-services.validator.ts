import { z } from "zod";

export const createPlatformServiceSchema = z.object({
  name:        z.string().min(2, "Name must be at least 2 characters.").max(200),
  description: z.string().max(1000).optional(),
  category:    z.enum(["SALON"]),
  service_for: z.enum(["MEN", "UNISEX"]),
  sort_order:  z.coerce.number().int().min(0).optional(),
});

export const updatePlatformServiceSchema = z
  .object({
    name:        z.string().min(2).max(200).optional(),
    description: z.string().max(1000).optional(),
    sort_order:  z.coerce.number().int().min(0).optional(),
    is_active:   z
      .enum(["true", "false"])
      .transform(v => v === "true")
      .optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field must be provided.",
  });

export type CreatePlatformServiceInput = z.infer<typeof createPlatformServiceSchema>;
export type UpdatePlatformServiceInput = z.infer<typeof updatePlatformServiceSchema>;
