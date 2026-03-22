import { prisma } from "../../../config/prisma";

export class AdminBusinessesRepository {

  static async find(opts: {
    search?:         string;
    city?:           string;
    state?:          string;
    is_verified?:    boolean;
    is_active?:      boolean;
    auth_suspended?: boolean; 
    skip:            number;
    take:            number;
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
    if (opts.city)                       filters.push({ city:        { contains: opts.city,  mode: "insensitive" } });
    if (opts.state)                      filters.push({ state:       { contains: opts.state, mode: "insensitive" } });
    if (opts.is_verified !== undefined)  filters.push({ is_verified: opts.is_verified });
    if (opts.is_active   !== undefined)  filters.push({ is_active:   opts.is_active });

    if (opts.auth_suspended !== undefined) {
      filters.push({ auth_user: { is_suspended: opts.auth_suspended } });
    }

    const where = filters.length ? { AND: filters } : {};

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: {
          owner:     { select: { id: true, name: true, user: { select: { email: true } } } },
          auth_user: { select: { id: true, is_active: true, is_suspended: true } },
          _count:    { select: { staff: true, bookings: true } },
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
        auth_user: {
          select: { id: true, email: true, is_active: true, is_suspended: true, suspended_at: true, suspended_reason: true },
        },
        images:   { select: { id: true, image_url: true, is_primary: true } },
        services: {
          include: { platform_service: { select: { id: true, name: true, category: true } } },
        },
        schedules: { orderBy: { day_of_week: "asc" } as any },
        staff: {
          where:  { is_active: true },
          select: { id: true, name: true, email: true, average_rating: true, total_reviews: true },
        },
        wallet: { select: { balance: true, lifetime_earnings: true } },
        _count:  { select: { staff: true, bookings: true, reviews: true } },
      },
    });
  }

  static async findBusinessWithAuthUser(businessId: string) {
    return prisma.business.findUnique({
      where:  { id: businessId },
      select: {
        id:            true,
        business_name: true,
        auth_user_id:  true,
        auth_user: {
          select: { id: true, email: true, is_suspended: true },
        },
        owner: {
          select: { user: { select: { id: true, email: true } } },
        },
      },
    });
  }

  static async setAuthUserSuspension(authUserId: string, suspend: boolean, reason?: string) {
    return prisma.user.update({
      where: { id: authUserId },
      data: {
        is_suspended:     suspend,
        suspended_at:     suspend ? new Date() : null,
        suspended_reason: suspend ? (reason ?? null) : null,
        is_active:        !suspend,
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