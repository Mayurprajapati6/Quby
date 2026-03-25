import { prisma } from "../../../config/prisma";

export class StaffQrLogRepository {

  static async find(staffId: string, opts: { date?: string; skip: number; take: number }) {
    const where: any = { used_by_staff: staffId, is_used: true };

    if (opts.date) {
      const day = new Date(`${opts.date}T00:00:00+05:30`);
      const nxt = new Date(day.getTime() + 86_400_000);
      where.used_at = { gte: day, lt: nxt };
    }

    const [records, total] = await Promise.all([
      prisma.qRCode.findMany({
        where,
        include: {
          booking: {
            select: {
              id:             true,
              booking_number: true,
              service_date:   true,
              services:       true,
              customer: { select: { id: true, name: true, avatar_url: true } },
            },
          },
        },
        orderBy: { used_at: "desc" },
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.qRCode.count({ where }),
    ]);

    return { records, total };
  }
}
