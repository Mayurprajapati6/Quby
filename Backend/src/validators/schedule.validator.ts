import { z } from "zod";

const DAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY",
  "FRIDAY", "SATURDAY", "SUNDAY",
] as const;

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dayScheduleEntry = z
  .object({
    day_of_week: z.enum(DAYS),
    is_open:     z.boolean(),
    open_time:   z.string().regex(TIME_RE, "open_time must be HH:MM.").optional(),
    close_time:  z.string().regex(TIME_RE, "close_time must be HH:MM.").optional(),
  })
  .refine(
    d => !d.is_open || (!!d.open_time && !!d.close_time),
    { message: "open_time and close_time are required when the day is open." },
  );

export const updateScheduleSchema = z.object({
  schedules: z.array(dayScheduleEntry).min(1).max(7),
});

export const createHolidaySchema = z
  .object({
    business_id:          z.string().uuid().optional(),
    holiday_name:         z.string().min(2).max(100),
    description:          z.string().max(1000).optional(),
    start_date:           z.string().regex(DATE_RE, "start_date must be YYYY-MM-DD."),
    end_date:             z.string().regex(DATE_RE, "end_date must be YYYY-MM-DD."),
    applies_to_all_staff: z.boolean().optional().default(true),
    staff_ids:            z.array(z.string().uuid()).optional(),
  })
  .refine(
    d => new Date(d.end_date) >= new Date(d.start_date),
    {
      message: "end_date must be on or after start_date.",
      path:    ["end_date"],
    },
  );

export const updateHolidaySchema = z
  .object({
    holiday_name:         z.string().min(2).max(100).optional(),
    description:          z.string().max(1000).optional(),
    start_date:           z.string().regex(DATE_RE).optional(),
    end_date:             z.string().regex(DATE_RE).optional(),
    applies_to_all_staff: z.boolean().optional(),
    staff_ids:            z.array(z.string().uuid()).optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
