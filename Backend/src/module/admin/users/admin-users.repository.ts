import { prisma } from "../../../config/prisma";

export class AdminUsersRepository {

  static async findOwners(opts: {
    search?: string;
    city?:   string;
    state?:  string;
    skip:    number;
    take:    number;
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
    if (opts.city)  filters.push({ city:  { contains: opts.city,  mode: "insensitive" } });
    if (opts.state) filters.push({ state: { contains: opts.state, mode: "insensitive" } });

    const where = filters.length ? { AND: filters } : {};

    const [owners, total] = await Promise.all([
      prisma.owner.findMany({
        where,
        include: {
          user:   { select: { id: true, email: true, is_active: true } },
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
        user: { select: { id: true, email: true, is_active: true, created_at: true } },
        businesses: {
          select: {
    id: true,
    business_name: true,
    city: true,
    state: true,
    is_active: true,
    is_verified: true,
    average_rating: true,
    logo_url: true,
    service_for: true,

    _count: { select: { staff: true } } // 🔥 ADD THIS
  },
          orderBy: { created_at: "desc" },
        },
      },
    });
  }

  static async findCustomers(opts: {
    search?: string;
    city?:   string;
    state?:  string;
    skip:    number;
    take:    number;
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
    if (opts.city)  filters.push({ city:  { contains: opts.city,  mode: "insensitive" } });
    if (opts.state) filters.push({ state: { contains: opts.state, mode: "insensitive" } });

    const where = filters.length ? { AND: filters } : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          user:   { select: { id: true, email: true, is_active: true } },
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
        user:   { select: { id: true, email: true, is_active: true, created_at: true } },
        _count: { select: { bookings: true, reviews: true } },
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
          user:     { select: { id: true, email: true, is_active: true } },
          business: {
  select: {
    id: true,
    business_name: true,
    city: true,
    logo_url: true, // 🔥 ADD THIS
  },
},
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
        user:      { select: { id: true, email: true, is_active: true, created_at: true } },
        business: {
  select: {
    id: true,
    business_name: true,
    city: true,
    state: true,
    logo_url: true, // 🔥 ADD
  },
},
        schedules: { orderBy: { day_of_week: "asc" } as any },
        services: {
          include: {
            service_offering: {
              include: { platform_service: {
  select: {
    name: true,
    category: true,
    service_for: true,
    image_url: true, // 🔥 ADD
  },
}},
            },
          },
        },
        _count: { select: { bookings: true, reviews: true, leaves: true } },
      },
    });
  }

  static async findUserById(userId: string) {
    return prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, email: true, role: true, is_active: true },
    });
  }

  // 🔥 ADD THIS METHOD
static async findStaffReviews(staffId: string) {
  return prisma.review.findMany({
    where: { staff_id: staffId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          avatar_url: true,
        },
      },
      booking: {
        select: {
          service_date: true,
          services: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });
}
}