import { z } from "zod";

export const requestLeaveSchema = z
  .object({
    leave_type: z.enum(["PERSONAL", "SICK", "EMERGENCY", "OTHER"], {
      errorMap: () => ({ message: "leave_type must be PERSONAL, SICK, EMERGENCY, or OTHER." }),
    }),
    start_date: z
      .string({ required_error: "start_date is required." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD."),
    end_date: z
      .string({ required_error: "end_date is required." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be YYYY-MM-DD."),
    reason: z
      .string({ required_error: "reason is required." })
      .min(5, "Reason must be at least 5 characters.")
      .max(500),
  })
  .refine(d => new Date(d.end_date) >= new Date(d.start_date), {
    message: "end_date must be on or after start_date.",
    path:    ["end_date"],
  })
  .refine(d => new Date(d.start_date) > new Date(), {
    message: "start_date must be in the future.",
    path:    ["start_date"],
  });

export type RequestLeaveInput = z.infer<typeof requestLeaveSchema>;
