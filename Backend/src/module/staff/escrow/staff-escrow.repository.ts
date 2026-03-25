import { prisma } from "../../../config/prisma";

export class StaffEscrowRepository {

  static async find(staffId: string, opts: { status?: string; from?: string; to?: string; skip: number; take: number }) {
    const where: any = { staff_id: staffId };
    if (opts.status) where.status = opts.status;
    if (opts.from || opts.to) {
      where.held_at = {};
      if (opts.from) where.held_at.gte = new Date(`${opts.from}T00:00:00+05:30`);
      if (opts.to)   where.held_at.lte = new Date(`${opts.to}T23:59:59+05:30`);
    }

    const [escrows, total] = await Promise.all([
      prisma.escrowTransaction.findMany({
        where,
        include: {
          booking: {
            select: {
              id:             true,
              booking_number: true,
              service_date:   true,
              services:       true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { held_at: "desc" },
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.escrowTransaction.count({ where }),
    ]);

    return { escrows, total };
  }

  static async getSummary(staffId: string) {
    const [held, released, refunded] = await Promise.all([
      prisma.escrowTransaction.aggregate({ where: { staff_id: staffId, status: "HELD" },     _sum: { amount: true }, _count: { id: true } }),
      prisma.escrowTransaction.aggregate({ where: { staff_id: staffId, status: "RELEASED" }, _sum: { amount: true }, _count: { id: true } }),
      prisma.escrowTransaction.aggregate({ where: { staff_id: staffId, status: "REFUNDED" }, _sum: { amount: true }, _count: { id: true } }),
    ]);
    return { held, released, refunded };
  }
}
