import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const daySchedule = z.object({
  day_of_week:  z.enum(["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"]),
  is_open:      z.boolean(),
  open_time:    z.string().regex(timeRegex, "Time must be HH:MM format.").optional(),
  close_time:   z.string().regex(timeRegex, "Time must be HH:MM format.").optional(),
}).refine(
  (d) => {
    if (d.is_open && (!d.open_time || !d.close_time)) return false;
    return true;
  },
  { message: "Open time and close time are required when day is open." }
);

export const updateScheduleSchema = z.object({
  schedules: z.array(daySchedule).min(1).max(7),
});

export const createHolidaySchema = z
  .object({
    holiday_name:        z.string().min(2).max(100),
    description:         z.string().max(500).optional(),
    start_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
    end_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
    applies_to_all_staff: z.boolean().default(true),
  })
  .refine(
    (d) => new Date(d.end_date) >= new Date(d.start_date),
    { message: "End date must be on or after start date.", path: ["end_date"] }
  );