import { z } from "zod";

export const attendanceDateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format (e.g. 2026-01-12).")
    .optional(),
});

export const markAttendanceSchema = z.object({
  staffId: z
    .string({ required_error: "staffId is required." })
    .uuid("staffId must be a valid UUID."),

  date: z
    .string({ required_error: "date is required." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format (e.g. 2026-01-12)."),

  status: z.enum(["PRESENT", "ABSENT"], {
    errorMap: () => ({ message: 'status must be "PRESENT" or "ABSENT".' }),
  }),

  notes: z
    .string()
    .max(500, "notes must be 500 characters or fewer.")
    .optional(),
});

export const attendanceMonthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format (e.g. 2026-01).")
    .optional(),
});

export type AttendanceDateQueryInput  = z.infer<typeof attendanceDateQuerySchema>;
export type AttendanceMonthQueryInput = z.infer<typeof attendanceMonthQuerySchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
