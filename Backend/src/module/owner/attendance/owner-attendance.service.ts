import {
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isAfter,
} from "date-fns";
import { NotFoundError, UnauthorizedError } from "../../../utils/errors/app.error";
import { OwnerAttendanceRepository as Repo } from "./owner-attendance.repository";
import type {
  OwnerDailyAttendanceDTO,
  OwnerStaffAttendanceDTO,
  BusinessAttendanceRowDTO,
  StaffAttendanceDayDTO,
  AttendanceDisplayStatus,
  AttendanceSource,
} from "../../attendance/attendance.types";

const DOW_MAP: Record<number, string> = {
  0:"SUNDAY",1:"MONDAY",2:"TUESDAY",3:"WEDNESDAY",
  4:"THURSDAY",5:"FRIDAY",6:"SATURDAY",
};

export class OwnerAttendanceService {

  static async getDailyAttendance(
    ownerId:    string,
    businessId: string,
    dateStr?:   string,
  ): Promise<OwnerDailyAttendanceDTO> {

    const biz = await Repo.findOwnerBusiness(ownerId, businessId);
    if (!biz) throw new UnauthorizedError("This business does not belong to you.");

    const date  = dateStr ? startOfDay(new Date(dateStr)) : startOfDay(new Date());
    const today = startOfDay(new Date());
    if (isAfter(date, today)) throw new NotFoundError("Cannot view future attendance.");

    const [allStaff, records, leaves, holiday] = await Promise.all([
      Repo.findActiveStaffForBusiness(businessId),
      Repo.findRecordsByBusinessAndDate(businessId, date),
      Repo.findApprovedLeavesOnDate(businessId, date),
      Repo.findHolidayOnDate(businessId, date),
    ]);

    const recordMap  = new Map(records.map(r => [r.staff_id, r]));
    const onLeaveIds = new Set(leaves.map(l => l.staff_id));

    const staffRows: BusinessAttendanceRowDTO[] = allStaff.map(s => {
      const rec = recordMap.get(s.id);
      if (rec) {
        const src = (rec.source ?? "BUSINESS_MANUAL") as AttendanceSource;
        return {
          staff_id:      s.id,
          staff_name:    s.name,
          staff_email:   s.email,
          avatar_url:    s.avatar_url,
          status:        rec.status as AttendanceDisplayStatus,
          source:        src,
          source_label:  src === "BOOKING" ? "Auto" : "Manual",
          check_in_time: rec.check_in_time ? format(rec.check_in_time, "HH:mm") : null,
          notes:         rec.notes,
        };
      }
      let derivedStatus: AttendanceDisplayStatus = "NOT_MARKED";
      if (holiday)                   derivedStatus = "HOLIDAY";
      else if (onLeaveIds.has(s.id)) derivedStatus = "LEAVE";

      return {
        staff_id:      s.id,
        staff_name:    s.name,
        staff_email:   s.email,
        avatar_url:    s.avatar_url,
        status:        derivedStatus,
        source:        null,
        source_label:  "",
        check_in_time: null,
        notes:         null,
      };
    });

    return {
      date:          format(date, "yyyy-MM-dd"),
      business_id:   businessId,
      business_name: biz.business_name,
      staff:         staffRows,
      summary: {
        total:      staffRows.length,
        present:    staffRows.filter(r => r.status === "PRESENT" || r.status === "HALF_DAY").length,
        absent:     staffRows.filter(r => r.status === "ABSENT").length,
        on_leave:   staffRows.filter(r => r.status === "LEAVE").length,
        holiday:    staffRows.filter(r => r.status === "HOLIDAY").length,
        not_marked: staffRows.filter(r => r.status === "NOT_MARKED").length,
      },
    };
  }

  static async getStaffAttendance(
    ownerId:  string,
    staffId:  string,
    monthStr?: string,
  ): Promise<OwnerStaffAttendanceDTO> {

    const staffRow = await Repo.findStaffWithBusiness(ownerId, staffId);
    if (!staffRow) throw new UnauthorizedError("Staff not found or does not belong to your business.");

    const refDate    = monthStr ? new Date(`${monthStr}-01`) : new Date();
    const monthStart = startOfMonth(refDate);
    const monthEnd   = endOfMonth(refDate);
    const today      = startOfDay(new Date());

    const [records, leaves, holidays, schedules] = await Promise.all([
      Repo.findStaffMonthlyRecords(staffRow.id, monthStart, monthEnd),
      Repo.findStaffLeavesInMonth(staffRow.id, monthStart, monthEnd),
      Repo.findBusinessHolidaysInMonth(staffRow.business_id, monthStart, monthEnd),
      Repo.findStaffSchedule(staffRow.id),
    ]);

    const recordMap   = new Map(records.map(r => [format(r.date, "yyyy-MM-dd"), r]));
    const workingDays = new Set(schedules.map(s => s.day_of_week));

    const isOnLeave = (d: Date) =>
      leaves.some(l => startOfDay(l.start_date) <= d && d <= startOfDay(l.end_date));
    const isHoliday = (d: Date) =>
      holidays.some(h => startOfDay(h.start_date) <= d && d <= startOfDay(h.end_date));

    const dayRecords: StaffAttendanceDayDTO[] = [];

    for (const d of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
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

      if (isHoliday(d)) { dayRecords.push({ date: key, status: "HOLIDAY", source: null, check_in_time: null, notes: null }); continue; }
      if (isOnLeave(d)) { dayRecords.push({ date: key, status: "LEAVE",   source: null, check_in_time: null, notes: null }); continue; }
      if (!workingDays.has(DOW_MAP[d.getDay()] as any)) continue;

      dayRecords.push({ date: key, status: "NOT_MARKED", source: null, check_in_time: null, notes: null });
    }

    const present   = dayRecords.filter(r => r.status === "PRESENT" || r.status === "HALF_DAY").length;
    const absent    = dayRecords.filter(r => r.status === "ABSENT").length;
    const onLeave   = dayRecords.filter(r => r.status === "LEAVE").length;
    const holiday   = dayRecords.filter(r => r.status === "HOLIDAY").length;
    const notMarked = dayRecords.filter(r => r.status === "NOT_MARKED").length;
    const totalWorkingDays = dayRecords.filter(r => r.status !== "HOLIDAY").length;
    const attendanceRate   = (present + absent + notMarked) > 0
      ? parseFloat(((present / (present + absent + notMarked)) * 100).toFixed(1))
      : 0;

    return {
      staff_id:      staffRow.id,
      staff_name:    staffRow.name,
      business_name: staffRow.business.business_name,
      month:         format(monthStart, "yyyy-MM"),
      records:       dayRecords,
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
