import { prisma } from "../../../config/prisma";

export class AdminBusinessesRepository {

  static async find(opts: {
    search?:      string;
    city?:        string;
    state?:       string;
    is_verified?: boolean;
    is_active?:   boolean;
    skip:         number;
    take:         number;
  }) {
    const filters: any[] = [];

    if (opts.search) {
      filters.push({
        OR: [
          { business_name: { contains: opts.search, mode: "insensitive" } },
          { city:          { contains: opts.search, mode: "insensitive" } },
          { owner: { name: { contains: opts.search, mode: "insensitive" } } },
        ],
      });
    }
    if (opts.city)                      filters.push({ city:        { contains: opts.city,  mode: "insensitive" } });
    if (opts.state)                     filters.push({ state:       { contains: opts.state, mode: "insensitive" } });
    if (opts.is_verified !== undefined) filters.push({ is_verified: opts.is_verified });
    if (opts.is_active   !== undefined) filters.push({ is_active:   opts.is_active });

    const where = filters.length ? { AND: filters } : {};

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: {
          owner:  { select: { id: true, name: true, user: { select: { email: true } } } },
          _count: {
  select: {
    staff: true,

    bookings: {
      where: {
        status: {
          in: ["COMPLETED", "NO_SHOW", "REFUNDED"], // ✅ IMPORTANT
        },
        
      },
    },

  },
},
        },
        orderBy: { created_at: "desc" },
        skip:    opts.skip,
        take:    opts.take,
      }),
      prisma.business.count({ where }),
    ]);

    return { businesses, total };
  }

  static async findById(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      include: {
        owner: {
          select: { id: true, name: true, phone: true, user: { select: { id: true, email: true } } },
        },
        images:   { select: { id: true, image_url: true, is_primary: true } },
        services: {
  select: {
    id: true,
    price: true,
    discounted_price: true,

    platform_service: {
      select: {
        id: true,
        name: true,
        category: true,
        image_url: true, // ✅ THIS WAS MISSING
      },
    },
  },
},
        schedules: { orderBy: { day_of_week: "asc" } as any },
        staff: {
  where:  { is_active: true },
  select: {
    id: true,
    name: true,
    email: true,
    avatar_url: true,   // ✅ ADD THIS
    average_rating: true,
    total_reviews: true
  },
},
        _count: {
  select: {
    staff: true,
    reviews: true,

    bookings: {
      where: {
        status: {
          in: ["COMPLETED", "NO_SHOW", "REFUNDED"],
        },
        
      },
    },

  },
},
      },
    });
  }

  static async createBusinessNotification(
    businessId: string,
    type:       string,
    title:      string,
    message:    string,
    target:     "OWNER" | "BUSINESS" | "BOTH",
  ) {
    return prisma.businessNotification.create({
      data: {
        business_id: businessId,
        type:        type as any,
        title,
        message,
        target,
        expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});
  }
}
