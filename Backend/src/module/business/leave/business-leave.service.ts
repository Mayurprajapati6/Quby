import { BusinessLeaveRepository } from "./business-leave.repository";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }

export class BusinessLeaveService {

  static async getHolidays(businessId: string, tab: "upcoming" | "running" | "completed") {
    const holidays = await BusinessLeaveRepository.findHolidays(businessId, tab);

    return holidays.map(h => ({
      id:                   h.id,
      holiday_name:         h.holiday_name,
      description:          h.description ?? null,
      start_date:           toISTDate(h.start_date),
      end_date:             toISTDate(h.end_date),
      applies_to_all_staff: h.applies_to_all_staff,
      staff_count:          (h as any)._count?.staff_holidays ?? 0,
      tab,
    }));
  }

  static async getLeaves(businessId: string, status?: string) {
    const leaves = await BusinessLeaveRepository.findLeaves(businessId, status);

    return leaves.map(l => ({
      id:               l.id,
      staff_id:         l.staff_id,
      staff_name:       l.staff.name,
      staff_avatar:     l.staff.avatar_url ?? null,
      leave_type:       l.leave_type,
      start_date:       toISTDate(l.start_date),
      end_date:         toISTDate(l.end_date),
      reason:           l.reason,
      status:           l.status,
      rejection_reason: l.rejection_reason ?? null,
      approved_at:      l.approved_at ? toIST(l.approved_at) : null,
      created_at:       toISTDate(l.created_at),
    }));
  }
}
