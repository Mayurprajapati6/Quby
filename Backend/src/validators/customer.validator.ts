import { z } from "zod";

export const updateCustomerProfileSchema = z
  .object({
    name:          z.string().trim().min(2, "Name must be at least 2 characters.").max(100).optional(),
    phone:         z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number.").optional(),
    city:          z.string().trim().min(2, "City must be at least 2 characters.").max(100).optional(),
    state:         z.string().trim().min(2, "State must be at least 2 characters.").max(100).optional(),
    gender:        z.enum(["MALE", "FEMALE", "OTHER"], {
      errorMap: () => ({ message: "Gender must be MALE, FEMALE, or OTHER." }),
    }).optional(),
    address_line1: z.string().trim().max(255).optional(),
    address_line2: z.string().trim().max(255).optional().nullable(),
  })
  .refine(
    data => Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined).length > 0,
    { message: "At least one field must be provided for update." },
  );

export const deleteCustomerAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete account."),
});

export const exploreQuerySchema = z
  .object({
    name:        z.string().trim().max(100).optional(),
    query:       z.string().trim().max(100).optional(),   // alias for name

    city:        z.string().trim().max(100).optional(),
    state:       z.string().trim().max(100).optional(),

    service_for: z.enum(["MEN", "UNISEX"]).optional(),
    min_rating:  z.coerce.number().min(1).max(5).optional(),
    is_open:     z.enum(["true", "false"]).transform(v => v === "true").optional(),

    lat:         z.coerce.number().min(-90).max(90).optional(),
    lng:         z.coerce.number().min(-180).max(180).optional(),
    radius_km:   z.coerce.number().min(0.5).max(100).default(10),

    page:        z.coerce.number().int().min(1).default(1),
    limit:       z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine(
    data => (data.lat != null) === (data.lng != null),
    {
      message: "lat and lng must both be provided for geo search.",
      path:    ["lat"],
    },
  );

export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
export type ExploreQueryInput = z.infer<typeof exploreQuerySchema>;
