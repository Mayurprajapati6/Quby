import { prisma } from "../../../config/prisma";

export class StaffOperationRepository {

  static async findLeaves(staffId: string, status?: string) {
    return prisma.staffLeave.findMany({
      where:   { staff_id: staffId, ...(status && { status: status as any }) },
      orderBy: { start_date: "desc" },
    });
  }

  static async findLeaveById(leaveId: string, staffId: string) {
    return prisma.staffLeave.findFirst({
      where: { id: leaveId, staff_id: staffId },
    });
  }

  static async findOverlappingLeave(staffId: string, startDate: Date, endDate: Date) {
    return prisma.staffLeave.findFirst({
      where: {
        staff_id:   staffId,
        status:     { not: "REJECTED" },
        start_date: { lte: endDate },
        end_date:   { gte: startDate },
      },
    });
  }

  static async createLeave(data: {
    staffId:   string;
    leaveType: string;
    startDate: Date;
    endDate:   Date;
    reason:    string;
  }) {
    return prisma.staffLeave.create({
      data: {
        staff_id:   data.staffId,
        leave_type: data.leaveType as any,
        start_date: data.startDate,
        end_date:   data.endDate,
        reason:     data.reason,
        status:     "PENDING",
      },
    });
  }

  static async deleteLeave(leaveId: string) {
    return prisma.staffLeave.delete({ where: { id: leaveId } });
  }
}
