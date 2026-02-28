import { z } from "zod";

const phone = z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits.");

export const createBusinessSchema = z.object({
    business_name:   z.string().min(2).max(200),
    service_for:     z.enum(["MEN", "UNISEX"]),
    description:     z.string().max(2000).optional(),

    address_line1:   z.string().min(5).max(255),
    address_line2:   z.string().max(255).optional(),
    city:            z.string().min(2).max(100),
    state:           z.string().min(2).max(100),
    pincode:         z.string().regex(/^\d{6}$/, "Pincode must be 6 digits."),
    latitude:        z.number().min(-90).max(90).optional(),
    longitude:       z.number().min(-180).max(180).optional(),

    business_email:  z.string().email().optional(),
    business_phone:  phone.optional(),
    website_url:     z.string().url().optional(),
});

export const updateBusinessSchema = z
    .object({
        business_name:  z.string().min(2).max(200).optional(),
        description:    z.string().max(2000).optional(),
        address_line1:  z.string().min(5).max(255).optional(),
        address_line2:  z.string().max(255).optional(),
        city:           z.string().min(2).max(100).optional(),
        state:          z.string().min(2).max(100).optional(),
        pincode:        z.string().regex(/^\d{6}$/).optional(),
        latitude:       z.number().min(-90).max(90).optional(),
        longitude:      z.number().min(-180).max(180).optional(),
        business_email: z.string().email().optional(),
        business_phone: phone.optional(),
        website_url:    z.string().url().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
        message: "At least one field must be provided.",
    });

export const rejectBusinessSchema = z.object({
    reason: z.string().min(10, "Please provide a detailed rejection reason.").max(1000),
});