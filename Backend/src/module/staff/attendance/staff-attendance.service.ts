import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfDay,
  isAfter,
} from "date-fns";
import { NotFoundError } from "../../../utils/errors/app.error";
import { StaffAttendanceRepository as Repo } from "./staff-attendance.repository";
import type {
  StaffMonthlyAttendanceDTO,
  StaffAttendanceDayDTO,
  AttendanceDisplayStatus,
  AttendanceSource,
} from "../../attendance/attendance.types";

const DOW_MAP: Record<number, string> = {
  0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY",  3: "WEDNESDAY",
  4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
};

export class StaffAttendanceService {

  static async getMonthlyAttendance(
    userId:   string,
    monthStr?: string,
  ): Promise<StaffMonthlyAttendanceDTO> {

    const staff = await Repo.findStaffByUserId(userId);
    if (!staff) throw new NotFoundError("Staff profile not found.");

    const refDate    = monthStr ? new Date(`${monthStr}-01`) : new Date();
    const monthStart = startOfMonth(refDate);
    const monthEnd   = endOfMonth(refDate);
    const today      = startOfDay(new Date());

    const [records, leaves, holidays, schedules] = await Promise.all([
      Repo.findMonthlyRecords(staff.id, monthStart, monthEnd),
      Repo.findLeavesInMonth(staff.id, monthStart, monthEnd),
      Repo.findHolidaysInMonth(staff.business_id, monthStart, monthEnd),
      Repo.findStaffSchedule(staff.id),
    ]);

    const recordMap   = new Map(records.map(r => [format(r.date, "yyyy-MM-dd"), r]));
    const workingDays = new Set(schedules.map(s => s.day_of_week));

    const isOnLeave = (d: Date) =>
      leaves.some(l => startOfDay(l.start_date) <= d && d <= startOfDay(l.end_date));

    const isHoliday = (d: Date) =>
      holidays.some(h => startOfDay(h.start_date) <= d && d <= startOfDay(h.end_date));

    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const dayRecords: StaffAttendanceDayDTO[] = [];

    for (const d of allDays) {
      if (isAfter(d, today)) continue;   

      const key = format(d, "yyyy-MM-dd");
      const rec = recordMap.get(key);

      if (rec) {
        dayRecords.push({
          date:          key,
          status:        rec.status as AttendanceDisplayStatus,
          source:        (rec.source ?? null) as AttendanceSource | null,
          check_in_time: rec.check_in_time ? format(rec.check_in_time, "HH:mm") : null,
          notes:         rec.notes,
        });
        continue;
      }

      if (isHoliday(d)) {
        dayRecords.push({ date: key, status: "HOLIDAY", source: null, check_in_time: null, notes: null });
        continue;
      }
      if (isOnLeave(d)) {
        dayRecords.push({ date: key, status: "LEAVE", source: null, check_in_time: null, notes: null });
        continue;
      }
      if (!workingDays.has(DOW_MAP[d.getDay()] as any)) {
        continue;   
      }

      dayRecords.push({ date: key, status: "NOT_MARKED", source: null, check_in_time: null, notes: null });
    }

    const present   = dayRecords.filter(r => r.status === "PRESENT" || r.status === "HALF_DAY").length;
    const absent    = dayRecords.filter(r => r.status === "ABSENT").length;
    const onLeave   = dayRecords.filter(r => r.status === "LEAVE").length;
    const holiday   = dayRecords.filter(r => r.status === "HOLIDAY").length;
    const notMarked = dayRecords.filter(r => r.status === "NOT_MARKED").length;

    const totalWorkingDays = dayRecords.filter(r => r.status !== "HOLIDAY").length;
    const attendanceRate   = totalWorkingDays > 0
      ? parseFloat(((present / (present + absent + notMarked)) * 100).toFixed(1))
      : 0;

    return {
      staff_id:   staff.id,
      staff_name: staff.name,
      month:      format(monthStart, "yyyy-MM"),
      records:    dayRecords,
      summary: {
        total_working_days: totalWorkingDays,
        present,
        absent,
        on_leave:        onLeave,
        holiday,
        not_marked:      notMarked,
        attendance_rate: attendanceRate,
      },
    };
  }
}
