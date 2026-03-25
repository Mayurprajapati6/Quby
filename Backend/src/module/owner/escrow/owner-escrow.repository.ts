import { prisma } from "../../../config/prisma";

export class OwnerEscrowRepository {

  static async find(opts: {
    businessIds: string[];
    business_id?: string;
    status?:     string;
    from?:       string;    
    to?:         string;
    page:        number;
    limit:       number;
  }) {
    const scope = opts.business_id
      ? [opts.business_id].filter(id => opts.businessIds.includes(id))
      : opts.businessIds;

    const where: any = { business_id: { in: scope } };

    if (opts.status) where.status = opts.status;
    if (opts.from || opts.to) {
      where.held_at = {};
      if (opts.from) where.held_at.gte = new Date(opts.from + "T00:00:00+05:30");
      if (opts.to)   where.held_at.lte = new Date(opts.to   + "T23:59:59+05:30");
    }

    const [rows, total] = await Promise.all([
      prisma.escrowTransaction.findMany({
        where,
        include: {
          booking: {
            select: {
              id:             true,
              booking_number: true,
              service_date:   true,
              service_start_time: true,
              customer:       { select: { name: true } },
              staff:          { select: { name: true } },
              business:       { select: { business_name: true } },
            },
          },
        },
        orderBy: { held_at: "desc" },
        skip:    (opts.page - 1) * opts.limit,
        take:    opts.limit,
      }),
      prisma.escrowTransaction.count({ where }),
    ]);

    return { rows, total };
  }

  static async findById(escrowId: string, businessIds: string[]) {
    return prisma.escrowTransaction.findFirst({
      where: { id: escrowId, business_id: { in: businessIds } },
      include: {
        booking: {
          select: {
            id:             true,
            booking_number: true,
            service_date:   true,
            service_start_time: true,
            service_amount: true,
            platform_fee:   true,
            customer:       { select: { name: true, phone: true } },
            staff:          { select: { name: true } },
            business:       { select: { business_name: true } },
          },
        },
      },
    });
  }

  static async getSummary(businessIds: string[]) {
    const [held, released, refunded] = await Promise.all([
      prisma.escrowTransaction.aggregate({
        where:  { business_id: { in: businessIds }, status: "HELD" },
        _sum:   { amount: true },
        _count: { id: true },
      }),
      prisma.escrowTransaction.aggregate({
        where:  { business_id: { in: businessIds }, status: "RELEASED" },
        _sum:   { amount: true },
        _count: { id: true },
      }),
      prisma.escrowTransaction.aggregate({
        where:  { business_id: { in: businessIds }, status: "REFUNDED" },
        _sum:   { amount: true },
        _count: { id: true },
      }),
    ]);

    return { held, released, refunded };
  }
}
