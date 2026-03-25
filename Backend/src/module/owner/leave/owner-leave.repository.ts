import { prisma } from "../../../config/prisma";

export class OwnerLeaveRepository {

  static async findAll(
    businessIds: string[],
    filters: { status?: string; business_id?: string },
  ) {
    const where: any = {
      staff: { business_id: { in: businessIds } },
      ...(filters.status      && { status:                 filters.status as any }),
      ...(filters.business_id && { staff: { business_id: filters.business_id } }),
    };

    return prisma.staffLeave.findMany({
      where,
      include: {
        staff: {
          select: {
            id:         true,
            name:       true,
            avatar_url: true,
            email:      true,
            user:       { select: { id: true } },
            business:   { select: { id: true, business_name: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  static async findOne(leaveId: string, businessIds: string[]) {
    return prisma.staffLeave.findFirst({
      where: { id: leaveId, staff: { business_id: { in: businessIds } } },
      include: {
        staff: {
          select: {
            id:         true,
            name:       true,
            email:      true,
            user:       { select: { id: true } },
            business:   { select: { id: true, business_name: true } },
          },
        },
      },
    });
  }

  static async process(
    leaveId:          string,
    approverId:       string,
    action:           "APPROVED" | "REJECTED",
    rejection_reason?: string,
  ) {
    return prisma.staffLeave.update({
      where: { id: leaveId },
      data: {
        status:           action,
        approved_by:      approverId,
        approved_at:      new Date(),
        rejection_reason: action === "REJECTED" ? (rejection_reason ?? null) : null,
      },
    });
  }
}
