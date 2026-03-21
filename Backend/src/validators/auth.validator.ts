import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(3,  "Username must be at least 3 characters.")
    .max(30, "Username must be at most 30 characters.")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores.")
    .optional(),

  email:    z.string().email("Invalid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name:     z.string().min(2, "Name must be at least 2 characters.").max(100),
  role:     z.enum(["CUSTOMER", "OWNER"]),
  phone:    z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number.").optional(),
  city:     z.string().min(1, "City is required.").default(""),
  state:    z.string().min(1, "State is required.").default(""),
}).superRefine((data, ctx) => {
  
  if (data.role === "CUSTOMER" && !data.username) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      path:    ["username"],
      message: "Username is required for customer accounts.",
    });
  }
  
  if (data.role === "OWNER" && !data.phone) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      path:    ["phone"],
      message: "Phone number is required for owner accounts.",
    });
  }
});

export const loginSchema = z.object({
  email:    z.string().email("Invalid email address."),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address."),
});

export const resetPasswordSchema = z.object({
  token:       z.string().min(1, "Reset token is required."),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword:     z.string().min(8, "New password must be at least 8 characters."),
});

export const staffSetupSchema = z.object({
  token:       z.string().min(1, "Setup token is required."),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete account."),
});

export const createBusinessAccountSchema = z.object({
  email:    z.string().email("Invalid email address.").toLowerCase().trim(),
  password: z
    .string()
    .min(8,  "Password must be at least 8 characters.")
    .max(64, "Password must be at most 64 characters."),
});

export const resetBusinessPasswordSchema = z.object({
  new_password: z
    .string()
    .min(8,  "Password must be at least 8 characters.")
    .max(64, "Password must be at most 64 characters."),
});

export const setBusinessStatusSchema = z.object({
  is_active: z.boolean({ required_error: "is_active (boolean) is required." }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type StaffSetupInput = z.infer<typeof staffSetupSchema>;
export type CreateBusinessAccountInput = z.infer<typeof createBusinessAccountSchema>;
