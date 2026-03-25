import { prisma } from "../../../config/prisma";

export class OwnerWalletRepository {

  static async findOwner(userId: string) {
    return prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true, lifetime_earnings: true },
    });
  }

  static async findBusinessesWithWallets(ownerId: string) {
    return prisma.business.findMany({
      where:   { owner_id: ownerId, is_active: true },
      select: {
        id:            true,
        business_name: true,
        logo_url:      true,
        wallet: {
          select: {
            balance:          true,
            lifetime_earnings:  true,
          },
        },
      },
    });
  }

  static async findEscrowHeldByBusiness(businessIds: string[]) {
    if (!businessIds.length) return [];
    return prisma.escrowTransaction.groupBy({
      by:    ["business_id"],
      where: { business_id: { in: businessIds }, status: "HELD" },
      _sum:  { amount: true },
    });
  }

  static async findEscrowHistory(
    businessIds: string[],
    filters: {
      businessId?: string;
      status?:     string;
      fromDate?:   Date;
      toDate?:     Date;
      skip?:       number;
      take?:       number;
    }
  ) {
    if (!businessIds.length) return { transactions: [], total: 0 };

    const where: any = {
      business_id: filters.businessId
        ? filters.businessId
        : { in: businessIds },
      ...(filters.status   && { status: filters.status }),
      ...(filters.fromDate && { held_at: { gte: filters.fromDate } }),
      ...(filters.toDate   && { held_at: { lte: filters.toDate } }),
    };

    const [transactions, total] = await Promise.all([
      prisma.escrowTransaction.findMany({
        where,
        orderBy: { held_at: "desc" },
        skip:    filters.skip ?? 0,
        take:    filters.take ?? 20,
        include: {
          booking: {
            select: {
              id:             true,
              booking_number: true,
              service_amount: true,
              platform_fee:   true,
              total_amount:   true,
              services:       true,
              business:       { select: { business_name: true } },
              customer:       { select: { name: true } },
              staff:          { select: { name: true } },
            },
          },
        },
      }),
      prisma.escrowTransaction.count({ where }),
    ]);

    return { transactions, total };
  }
}