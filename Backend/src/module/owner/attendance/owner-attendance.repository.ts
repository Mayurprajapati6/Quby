import { prisma } from "../../../config/prisma";
import { startOfDay } from "date-fns";

export class OwnerAttendanceRepository {

  static async findOwnerBusiness(ownerId: string, businessId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: ownerId },
      select: { id: true },
    });
    if (!owner) return null;

    return prisma.business.findFirst({
      where:  { id: businessId, owner_id: owner.id },
      select: { id: true, business_name: true },
    });
  }

  static async findStaffWithBusiness(ownerId: string, staffId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: ownerId },
      select: { id: true },
    });
    if (!owner) return null;

    return prisma.staff.findFirst({
      where: {
        id:       staffId,
        business: { owner_id: owner.id },
      },
      select: {
        id:          true,
        name:        true,
        business_id: true,
        business:    { select: { business_name: true } },
      },
    });
  }

  static async findActiveStaffForBusiness(businessId: string) {
    return prisma.staff.findMany({
      where:   { business_id: businessId, is_active: true },
      select:  { id: true, name: true, email: true, avatar_url: true },
      orderBy: { name: "asc" },
    });
  }

  static async findRecordsByBusinessAndDate(businessId: string, date: Date) {
    return prisma.staffAttendance.findMany({
      where: { business_id: businessId, date: startOfDay(date) },
      select: {
        staff_id:      true,
        status:        true,
        source:        true,
        check_in_time: true,
        marked_by:     true,
        notes:         true,
      },
    });
  }

  static async findApprovedLeavesOnDate(businessId: string, date: Date) {
    return prisma.staffLeave.findMany({
      where: {
        staff:      { business_id: businessId },
        status:     "APPROVED",
        start_date: { lte: date },
        end_date:   { gte: date },
      },
      select: { staff_id: true },
    });
  }

  static async findHolidayOnDate(businessId: string, date: Date) {
    return prisma.holiday.findFirst({
      where: {
        business_id: businessId,
        start_date:  { lte: date },
        end_date:    { gte: date },
      },
      select: { id: true },
    });
  }

  static async findStaffMonthlyRecords(staffId: string, monthStart: Date, monthEnd: Date) {
    return prisma.staffAttendance.findMany({
      where: {
        staff_id: staffId,
        date:     { gte: monthStart, lte: monthEnd },
      },
      select: {
        date:          true,
        status:        true,
        source:        true,
        check_in_time: true,
        notes:         true,
      },
      orderBy: { date: "asc" },
    });
  }

  static async findStaffLeavesInMonth(staffId: string, monthStart: Date, monthEnd: Date) {
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

  static async findBusinessHolidaysInMonth(businessId: string, monthStart: Date, monthEnd: Date) {
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
