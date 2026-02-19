import { z } from "zod";


const email = z.string().email("Invalid email format.");

const phone = z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must include uppercase, lowercase, and a number."
  );

const name = z
  .string()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name cannot exceed 100 characters.");

const city = z.string().min(2, "City must be at least 2 characters.");

const state = z.string().min(2, "State must be at least 2 characters.");

const role = z.enum(["CUSTOMER", "OWNER"], {
  errorMap: () => ({
    message: "Role must be CUSTOMER or OWNER. Staff accounts are created by employers.",
  }),
});

export const signupSchema = z
  .object({
    name,
    email,
    password,
    city,
    state,
    phone: phone.optional(),
    role,
  })
  .refine((data) => !(data.role === "OWNER" && !data.phone), {
    message: "Phone number is required for owner accounts.",
    path: ["phone"],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export const staffSetupSchema = z.object({
  token: z.string().min(1, "Setup token is required."),
  newPassword: password,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  newPassword: password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: password,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password confirmation is required to delete your account."),
});