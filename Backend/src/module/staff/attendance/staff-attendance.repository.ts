import { prisma } from "../../../config/prisma";

export class StaffAttendanceRepository {

  static async findStaffByUserId(userId: string) {
    return prisma.staff.findUnique({
      where:  { user_id: userId },
      select: {
        id:          true,
        name:        true,
        business_id: true,
        business:    { select: { business_name: true } },
      },
    });
  }

  static async findMonthlyRecords(staffId: string, monthStart: Date, monthEnd: Date) {
    return prisma.staffAttendance.findMany({
      where: {
        staff_id: staffId,
        date:     { gte: monthStart, lte: monthEnd },
      },
      select: {
        id:            true,
        date:          true,
        status:        true,
        source:        true,
        check_in_time: true,
        notes:         true,
      },
      orderBy: { date: "asc" },
    });
  }

  static async findLeavesInMonth(staffId: string, monthStart: Date, monthEnd: Date) {
    return prisma.staffLeave.findMany({
      where: {
        staff_id:   staffId,
        status:     "APPROVED",
        start_date: { lte: monthEnd },
        end_date:   { gte: monthStart },
      },
      select: { start_date: true, end_date: true },
    });
  }

  static async findHolidaysInMonth(businessId: string, monthStart: Date, monthEnd: Date) {
    return prisma.holiday.findMany({
      where: {
        business_id: businessId,
        start_date:  { lte: monthEnd },
        end_date:    { gte: monthStart },
      },
      select: { start_date: true, end_date: true },
    });
  }

  static async findStaffSchedule(staffId: string) {
    return prisma.staffSchedule.findMany({
      where:  { staff_id: staffId, is_available: true },
      select: { day_of_week: true },
    });
  }
}
