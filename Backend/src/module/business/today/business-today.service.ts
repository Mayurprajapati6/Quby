import { BusinessTodayRepository } from "./business-today.repository";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }

type StaffQueueStatus = "BUSY" | "FREE" | "ON_LEAVE" | "HOLIDAY";

function toBookingItem(b: any) {
  return {
    id:                   b.id,
    booking_number:       b.booking_number,
    queue_number:         b.queue_number,
    status:               b.status,
    arrival_window_start: toIST(b.arrival_window_start),
    arrival_window_end:   toIST(b.arrival_window_end),
    service_start_time:   toIST(b.service_start_time),
    service_end_time:     toIST(b.service_end_time),
    checked_in_at:        b.checked_in_at   ? toIST(b.checked_in_at)   : null,
    service_started_at:   b.service_started_at ? toIST(b.service_started_at) : null,
    estimated_duration:   b.estimated_duration,
    services:             Array.isArray(b.services) ? b.services.map((s: any) => s.name ?? "") : [],
    customer: {
      id:         b.customer.id,
      name:       b.customer.name,
      phone:      b.customer.phone       ?? null,
      avatar_url: b.customer.avatar_url  ?? null,
    },
    staff: {
      id:         b.staff.id,
      name:       b.staff.name,
      avatar_url: b.staff.avatar_url ?? null,
    },
  };
}

export class BusinessTodayService {

  static async getTodayQueue(businessId: string) {
    const [bookings, { allStaff, approvedLeaves, runningHoliday }, summary] = await Promise.all([
      BusinessTodayRepository.getLiveQueue(businessId),
      BusinessTodayRepository.getStaffStatus(businessId),
      BusinessTodayRepository.getDaySummary(businessId),
    ]);

    const onLeaveIds   = new Set(approvedLeaves.map((l: any) => l.staff_id));
    const isHolidayAll = runningHoliday?.applies_to_all_staff ?? false;

    const busyStaffIds = new Set(
      bookings
        .filter(b => b.status === "CHECKED_IN" || b.status === "RUNNING")
        .map(b => b.staff_id),
    );

    const staffList = allStaff.map((s: any) => {
      let status: StaffQueueStatus = "FREE";
      if      (isHolidayAll || onLeaveIds.has(s.id)) status = isHolidayAll ? "HOLIDAY" : "ON_LEAVE";
      else if (busyStaffIds.has(s.id))               status = "BUSY";
      return {
        id:         s.id,
        name:       s.name,
        avatar_url: s.avatar_url ?? null,
        status,
      };
    });

    const RUNNING_STATUSES = new Set(["CHECKED_IN", "RUNNING"]);

    const running  = bookings.filter(b => RUNNING_STATUSES.has(b.status)).map(toBookingItem);
    const upcoming = bookings.filter(b => b.status === "CONFIRMED").map(toBookingItem);

    return { summary, staff: staffList, running, upcoming };
  }
}
