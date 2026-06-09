import { prisma } from "../../../config/prisma";
import { startOfDay} from "date-fns";

export class OwnerBusinessRepository {

  static async findByOwnerId(ownerId: string) {
    return prisma.business.findFirst({
      where:   { owner_id: ownerId, is_active: true },
      select:  { id: true, business_name: true },
      orderBy: { created_at: "asc" },
    });
  }

  static async findAllByOwnerId(
    ownerId: string,
    filters: { name?: string; city?: string; state?: string },
    page:    number,
    limit:   number,
  ) {

    const where: any = {
      owner_id: ownerId,
      ...(filters.name  && { business_name: { contains: filters.name,  mode: "insensitive" } }),
      ...(filters.city  && { city:           { contains: filters.city,  mode: "insensitive" } }),
      ...(filters.state && { state:          { contains: filters.state, mode: "insensitive" } }),
    };

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: {
          images: {
            where:   { is_primary: true },
            take:    1,
            select:  { image_url: true },
          },
          _count: {
            select: {
              staff:    true,
              bookings: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.business.count({ where }),
    ]);

    const todayBookingCounts = await prisma.booking.groupBy({
      by:      ["business_id"],
      where: {
        business_id: { in: businesses.map(b => b.id) },
        service_date: {
  gte: startOfDay(new Date()),
  lt: new Date(new Date().setDate(new Date().getDate() + 1)),
},
        status: "COMPLETED",
payment: {
  is: {
    status: "SETTLED",
  },
},
      },
      _count: { id: true },
    });

    const todayCountMap = new Map(
      todayBookingCounts.map(r => [r.business_id, r._count.id])
    );

    const activeStaffCounts = await prisma.staff.groupBy({
      by:    ["business_id"],
      where: { business_id: { in: businesses.map(b => b.id) }, is_active: true },
      _count: { id: true },
    });
    const staffCountMap = new Map(
      activeStaffCounts.map(r => [r.business_id, r._count.id])
    );

    // 🔥 ADD THIS BLOCK (REVENUE CALCULATION)
const earnings = await prisma.booking.groupBy({
  by: ["business_id"],
  where: {
    business_id: { in: businesses.map(b => b.id) },
    status: {
  in: ["COMPLETED", "NO_SHOW"],
},
    payment: {
      is: {
        status: {
      in: ["PAID", "SETTLED"],
    },
      },
    },
  },
  _sum: {
    service_amount: true,
  },
})

const earningMap = new Map(
  earnings.map(e => [e.business_id, e._sum.service_amount  ?? 0])
)

    return {
      businesses: businesses.map(b => ({
        ...b,
        primary_image:     b.images[0]?.image_url ?? null,
        settled_earning: earningMap.get(b.id) ?? 0,
        active_staff_count: staffCountMap.get(b.id) ?? 0,
        today_bookings:    todayCountMap.get(b.id)  ?? 0,
      })),
      total,
    };
  }

  static async findByOwnerAndId(ownerId: string, businessId: string) {
    return prisma.business.findFirst({
      where: { id: businessId, owner_id: ownerId },
      include: {
        images:    { orderBy: { sort_order: "asc" } },
        schedules: { orderBy: { day_of_week: "asc" } },
        services:  {
          where:   { is_active: true },
          include: { platform_service: { select: { id: true, name: true, category: true } } },
          orderBy: { booking_count: "desc" },
        },
        _count:  { select: { staff: true, bookings: true, reviews: true } },
      },
    });
  }

  static async findByIdForDeletion(businessId: string) {
    return prisma.business.findUnique({
      where:   { id: businessId },
      include: {
        images: { select: { id: true, public_id: true } },
        _count: {
          select: {
            bookings: {
              where: {
                status: { in: ["CONFIRMED", "RUNNING"] },
              },
            },
          },
        },
      },
    });
  }

  static async create(data: {
    ownerId:            string;
    business_name:      string;
    slug:               string;
    business_type:      string;
    service_for:        string;
    description?:       string;
    address_line1:      string;
    address_line2?:     string;
    city:               string;
    state:              string;
    pincode:            string;
    country?:           string;
    latitude?:          number;
    longitude?:         number;
    map_link?:          string;
    business_email?:    string;
    business_phone?:    string;
    website_url?:       string;
    instagram_url?:     string;
    facebook_url?:      string;
    twitter_url?:       string;
    youtube_url?:       string;
    whatsapp_number?:   string;
    logo_url?:          string;
    cover_image_url?:   string;
    break_time_minutes?:        number;
    cancellation_window_hours?: number;
  }) {
    return prisma.business.create({
      data: {
        owner_id:          data.ownerId,
        business_name:     data.business_name,
        slug:              data.slug,
        business_type:     data.business_type as any,
        service_for:       data.service_for   as any,
        description:       data.description,
        address_line1:     data.address_line1,
        address_line2:     data.address_line2,
        city:              data.city,
        state:             data.state,
        pincode:           data.pincode,
        country:           data.country ?? "India",
        latitude:          data.latitude,
        longitude:         data.longitude,
        map_link:          data.map_link,
        business_email:    data.business_email,
        business_phone:    data.business_phone,
        website_url:       data.website_url,
        instagram_url:     data.instagram_url,
        facebook_url:      data.facebook_url,
        twitter_url:       data.twitter_url,
        youtube_url:       data.youtube_url,
        whatsapp_number:   data.whatsapp_number,
        logo_url:          data.logo_url,
        cover_image_url:   data.cover_image_url,
        break_time_minutes:        data.break_time_minutes        ?? 5,
        cancellation_window_hours: data.cancellation_window_hours ?? 2,
        is_verified:               true,
        is_active:                 true,
      },
    });
  }

  static async update(businessId: string, data: Record<string, any>) {
    return prisma.business.update({ where: { id: businessId }, data });
  }

  static async delete(businessId: string) {
    return prisma.business.delete({ where: { id: businessId } });
  }

  static async checkBusinessEmailExists(email: string, excludeId?: string) {
    return prisma.business.findFirst({
      where: {
        business_email: email,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
  }

  static async createImage(data: {
    business_id: string;
    image_url:   string;
    public_id?:  string;
    sort_order:  number;
    is_primary:  boolean;
  }) {
    return prisma.businessImage.create({ data });
  }

  static async findImage(imageId: string) {
    return prisma.businessImage.findUnique({ where: { id: imageId } });
  }

  static async deleteImage(imageId: string) {
    return prisma.businessImage.delete({ where: { id: imageId } });
  }

  static async countImages(businessId: string) {
    return prisma.businessImage.count({ where: { business_id: businessId } });
  }

  static async setImageAsPrimary(businessId: string, imageId: string) {
    await prisma.businessImage.updateMany({
      where: { business_id: businessId },
      data:  { is_primary: false },
    });
    return prisma.businessImage.update({
      where: { id: imageId },
      data:  { is_primary: true },
    });
  }
}