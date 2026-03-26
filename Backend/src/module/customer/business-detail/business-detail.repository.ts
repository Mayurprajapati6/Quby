import { prisma } from "../../../config/prisma";
import { startOfDay, endOfDay } from "date-fns";

export class BusinessDetailRepository {

  static async findBySlug(slug: string) {
    return prisma.business.findUnique({
      where: { slug },
      include: {
        
        owner: {
          select: { name: true },
        },

        images: {
          orderBy: { sort_order: "asc" },
        },

        schedules: {
          orderBy: { day_of_week: "asc" },
        },

        services: {
          where: { is_active: true },
          include: {
            platform_service: {
              select: { id: true, name: true, service_for: true },
            },
          },
          orderBy: { booking_count: "desc" },
        },

        staff: {
          where: { is_active: true },
          include: {
            services: {
              where: { is_available: true },
              include: {
                service_offering: {
                  select: {
                    id: true,
                    platform_service: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { average_rating: "desc" },
        },
      },
    });
  }

  static async findReviews(
    businessId:  string,
    opts: {
      rating?: number;
      page:    number;
      limit:   number;
    }
  ) {
    const where: any = {
      business_id: businessId,
      is_visible:  true,
      ...(opts.rating && { overall_rating: opts.rating }),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          customer: {
            select: { name: true, avatar_url: true },
          },
          staff: {
            select: { id: true, name: true, avatar_url: true },
          },
        },
        orderBy: { created_at: "desc" },
        skip:    (opts.page - 1) * opts.limit,
        take:    opts.limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, total };
  }

  static async findStaffWithProfile(staffId: string, businessId: string) {
    return prisma.staff.findFirst({
      where: { id: staffId, business_id: businessId, is_active: true },
      select: {
        id:             true,
        name:           true,
        avatar_url:     true,
        average_rating: true,
        total_reviews:  true,
      },
    });
  }

  static async findStaffReviews(
    staffId: string,
    opts: {
      rating?: number;
      page:    number;
      limit:   number;
    }
  ) {
    const where: any = {
      staff_id:   staffId,
      is_visible: true,
      ...(opts.rating && { staff_rating: opts.rating }),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          customer: {
            select: { name: true, avatar_url: true },
          },
        },
        orderBy: { created_at: "desc" },
        skip:    (opts.page - 1) * opts.limit,
        take:    opts.limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, total };
  }

  static async isFavourited(
    customerProfileId: string,
    businessId:        string
  ): Promise<boolean> {
    const count = await prisma.customerFavourite.count({
      where: { customer_id: customerProfileId, business_id: businessId },
    });
    return count > 0;
  }

  static async findStaffOnLeaveToday(staffIds: string[]): Promise<Set<string>> {
    if (staffIds.length === 0) return new Set();
    const today = new Date();
    const leaves = await prisma.staffLeave.findMany({
      where: {
        staff_id:   { in: staffIds },
        status:     "APPROVED",
        start_date: { lte: endOfDay(today) },
        end_date:   { gte: startOfDay(today) },
      },
      select: { staff_id: true },
    });
    return new Set(leaves.map(l => l.staff_id));
  }

  static async findBusyStaffNow(staffIds: string[]): Promise<Set<string>> {
    if (staffIds.length === 0) return new Set();
    const today = new Date();
    const bookings = await prisma.booking.findMany({
      where: {
        staff_id:     { in: staffIds },
        service_date: today,
        status:       { in: ["CHECKED_IN", "IN_PROGRESS"] },
      },
      select: { staff_id: true },
    });
    return new Set(bookings.map(b => b.staff_id));
  }

  static async findHolidayToday(businessId: string) {
    const today = new Date();
    return prisma.holiday.findFirst({
      where: {
        business_id: businessId,
        start_date:  { lte: endOfDay(today) },
        end_date:    { gte: startOfDay(today) },
      },
      select: { applies_to_all_staff: true },
    });
  }
}
