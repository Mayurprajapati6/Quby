import { prisma } from "../../../config/prisma";

export class AdminUsersRepository {

  static async findOwners(opts: {
    search?:       string;
    is_suspended?: boolean;
    skip:          number;
    take:          number;
  }) {
    const filters: any[] = [];

    if (opts.search) {
      filters.push({
        OR: [
          { name:  { contains: opts.search, mode: "insensitive" } },
          { phone: { contains: opts.search, mode: "insensitive" } },
          { user:  { email: { contains: opts.search, mode: "insensitive" } } },
        ],
      });
    }

    if (opts.is_suspended !== undefined) {
      filters.push({ user: { is_suspended: opts.is_suspended } });
    }

    const where = filters.length ? { AND: filters } : {};

    const [owners, total] = await Promise.all([
      prisma.owner.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, is_active: true, is_suspended: true, suspended_at: true, suspended_reason: true },
          },
          _count: { select: { businesses: true } },
        },
        orderBy: { created_at: "desc" },
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.owner.count({ where }),
    ]);

    return { owners, total };
  }

  static async findOwnerById(ownerId: string) {
    return prisma.owner.findUnique({
      where:   { id: ownerId },
      include: {
        user: {
          select: { id: true, email: true, is_active: true, is_suspended: true, suspended_at: true, suspended_reason: true, created_at: true },
        },
        businesses: {
          select: {
            id: true, business_name: true, city: true, state: true,
            is_active: true, is_verified: true, average_rating: true,
          },
          orderBy: { created_at: "desc" },
        },
      },
    });
  }

  static async findCustomers(opts: {
    search?:       string;
    city?:         string;
    state?:        string;
    is_suspended?: boolean;
    skip:          number;
    take:          number;
  }) {
    const filters: any[] = [];

    if (opts.search) {
      filters.push({
        OR: [
          { name:     { contains: opts.search, mode: "insensitive" } },
          { username: { contains: opts.search, mode: "insensitive" } },
          { user:     { email: { contains: opts.search, mode: "insensitive" } } },
        ],
      });
    }
    if (opts.city)         filters.push({ city:  { contains: opts.city,  mode: "insensitive" } });
    if (opts.state)        filters.push({ state: { contains: opts.state, mode: "insensitive" } });
    if (opts.is_suspended !== undefined) {
      filters.push({ user: { is_suspended: opts.is_suspended } });
    }

    const where = filters.length ? { AND: filters } : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, is_active: true, is_suspended: true, suspended_at: true, suspended_reason: true },
          },
          _count: { select: { bookings: true, reviews: true } },
        },
        orderBy: { created_at: "desc" },
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total };
  }

  static async findCustomerById(customerId: string) {
    return prisma.customer.findUnique({
      where:   { id: customerId },
      include: {
        user: {
          select: { id: true, email: true, is_active: true, is_suspended: true, suspended_at: true, suspended_reason: true, created_at: true },
        },
        wallet: { select: { balance: true, lifetime_spent: true, lifetime_refunds: true } },
        _count: { select: { bookings: true, reviews: true, favourites: true } },
      },
    });
  }

  static async findStaff(opts: {
    search?:      string;
    business_id?: string;
    skip:         number;
    take:         number;
  }) {
    const where: any = {};
    if (opts.search) {
      where.OR = [
        { name:  { contains: opts.search, mode: "insensitive" } },
        { email: { contains: opts.search, mode: "insensitive" } },
        { phone: { contains: opts.search, mode: "insensitive" } },
      ];
    }
    if (opts.business_id) where.business_id = opts.business_id;

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, is_active: true, is_suspended: true, suspended_at: true, suspended_reason: true },
          },
          business: { select: { id: true, business_name: true, city: true } },
          _count:   { select: { bookings: true, reviews: true } },
        },
        orderBy: { created_at: "desc" },
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.staff.count({ where }),
    ]);

    return { staff, total };
  }

  static async findStaffById(staffId: string) {
    return prisma.staff.findUnique({
      where:   { id: staffId },
      include: {
        user: {
          select: { id: true, email: true, is_active: true, is_suspended: true, suspended_at: true, suspended_reason: true, created_at: true },
        },
        business: { select: { id: true, business_name: true, city: true, state: true } },
        services: {
          include: {
            service_offering: {
              include: { platform_service: { select: { name: true, category: true } } },
            },
          },
        },
        _count: { select: { bookings: true, reviews: true, leaves: true } },
      },
    });
  }

  static async setUserSuspension(
    userId:   string,
    suspend:  boolean,
    reason?:  string,
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        is_suspended:     suspend,
        suspended_at:     suspend ? new Date() : null,
        suspended_reason: suspend ? (reason ?? null) : null,
        ...(suspend  && { is_active: false, version: { increment: 1 } }),
        ...(!suspend && { is_active: true }),
      },
      select: { id: true, email: true, is_suspended: true, is_active: true },
    });
  }

  static async findUserById(userId: string) {
    return prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, email: true, role: true, is_suspended: true },
    });
  }
}