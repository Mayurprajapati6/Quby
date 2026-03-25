import { prisma } from "../../../config/prisma";
import { StaffHolidayRepository } from "./staff-holiday.repository";
import { NotFoundError, ForbiddenError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

async function resolveStaff(userId: string) {
  const s = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, business_id: true, is_active: true },
  });
  if (!s) throw new NotFoundError("Staff profile not found.");
  if (!s.is_active) throw new ForbiddenError("Your account has been deactivated.");
  return s;
}

export class StaffHolidayService {

  static async getHolidays(userId: string, tab: "upcoming" | "running" | "completed") {
    const staff    = await resolveStaff(userId);
    const holidays = await StaffHolidayRepository.findForStaff(
      staff.business_id, staff.id, tab,
    );

    return holidays.map(h => ({
      id:                   h.id,
      holiday_name:         h.holiday_name,
      description:          h.description          ?? null,
      start_date:           toISTDate(h.start_date),
      end_date:             toISTDate(h.end_date),
      applies_to_all_staff: h.applies_to_all_staff,
      tab,
    }));
  }
}
