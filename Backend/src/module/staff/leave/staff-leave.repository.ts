import { prisma } from "../../../config/prisma";

export class StaffLeaveRepository {

  static async findStaffByUserId(userId: string) {
    return prisma.staff.findUnique({
      where:  { user_id: userId },
      select: {
        id:          true,
        name:        true,
        email:       true,
        business_id: true,
        is_active:   true,
        business: {
          select: {
            id:            true,
            business_name: true,
            owner: {
              select: {
                id:   true,
                name: true,
                user: { select: { id: true, email: true } },
              },
            },
          },
        },
      },
    });
  }

  static async findAll(staffId: string) {
    return prisma.staffLeave.findMany({
      where:   { staff_id: staffId },
      orderBy: { start_date: "desc" },
    });
  }

  static async findOne(leaveId: string, staffId: string) {
    return prisma.staffLeave.findFirst({
      where: { id: leaveId, staff_id: staffId },
    });
  }

  static async findOverlapping(staffId: string, startDate: Date, endDate: Date) {
    return prisma.staffLeave.findFirst({
      where: {
        staff_id:   staffId,
        status:     { not: "REJECTED" },
        start_date: { lte: endDate },
        end_date:   { gte: startDate },
      },
    });
  }

  static async create(data: {
    staffId:   string;
    leaveType: string;
    startDate: Date;
    endDate:   Date;
    reason:    string;
  }) {
    return prisma.staffLeave.create({
      data: {
        staff_id:   data.staffId,
        leave_type: data.leaveType,
        start_date: data.startDate,
        end_date:   data.endDate,
        reason:     data.reason,
        status:     "PENDING",
      },
    });
  }
  
  static async deletePending(leaveId: string) {
    return prisma.staffLeave.delete({ where: { id: leaveId } });
  }
}