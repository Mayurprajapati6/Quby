import { z } from "zod";

const urlOptional = z.string().url().optional().or(z.literal(""));

export const createBusinessSchema = z.object({
  business_name:      z.string().min(2).max(200),
  business_type:      z.enum(["SALON"]).optional().default("SALON"),
  service_for:        z.enum(["MEN", "WOMEN", "UNISEX"]),
  description:        z.string().max(2000).optional(),

  address_line1:      z.string().min(5).max(255),
  address_line2:      z.string().max(255).optional(),
  city:               z.string().min(2).max(100),
  state:              z.string().min(2).max(100),
  pincode:            z.string().min(4).max(10),
  country:            z.string().max(100).optional().default("India"),

  latitude:           z.coerce.number().min(-90).max(90).optional(),
  longitude:          z.coerce.number().min(-180).max(180).optional(),
  map_link:           urlOptional,

  business_phone:     z.string().max(20).optional(),
  website_url:        urlOptional,
  instagram_url:      urlOptional,
  facebook_url:       urlOptional,
  twitter_url:        urlOptional,
  youtube_url:        urlOptional,
  whatsapp_number:    z.string().max(20).optional(),

  break_time_minutes:        z.coerce.number().int().min(0).max(60).optional().default(5),
  cancellation_window_hours: z.coerce.number().int().min(0).max(48).optional().default(2),
});

export const updateBusinessSchema = createBusinessSchema
  .partial()
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field is required.",
  });

export const updateBusinessProfileSchema = z
  .object({
    business_name:      z.string().min(2).max(200).optional(),
    description:        z.string().max(2000).optional(),
    address_line1:      z.string().max(255).optional(),
    address_line2:      z.string().max(255).optional(),
    city:               z.string().max(100).optional(),
    state:              z.string().max(100).optional(),
    pincode:            z.string().max(10).optional(),
    map_link:           z.string().url().or(z.literal("")).optional(),
    business_phone:     z.string().max(20).optional(),
    website_url:        z.string().url().or(z.literal("")).optional(),
    instagram_url:      z.string().url().or(z.literal("")).optional(),
    facebook_url:       z.string().url().or(z.literal("")).optional(),
    twitter_url:        z.string().url().or(z.literal("")).optional(),
    youtube_url:        z.string().url().or(z.literal("")).optional(),
    whatsapp_number:    z.string().max(20).optional(),
    break_time_minutes:        z.coerce.number().int().min(0).max(60).optional(),
    cancellation_window_hours: z.coerce.number().int().min(0).max(48).optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field is required.",
  });

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type UpdateBusinessProfileInput  = z.infer<typeof updateBusinessProfileSchema>;

export const businessBookingsQuerySchema = z.object({
  status:   z.enum(["PENDING_PAYMENT","CONFIRMED","CHECKED_IN","IN_PROGRESS","RUNNING","COMPLETED","CANCELLED","CANCELLED_TIMEOUT","CANCELLED_NO_SHOW"]).optional(),
  staff_id: z.string().uuid().optional(),
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD.").optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(50).default(20),
});

export type BusinessBookingsQueryInput = z.infer<typeof businessBookingsQuerySchema>;