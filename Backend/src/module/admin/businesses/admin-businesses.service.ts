import { AdminBusinessesRepository } from "./admin-businesses.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const TZ = "Asia/Kolkata";
function toTZ(d: Date)     { return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toTZDate(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM-dd"); }

function toListItem(b: any) {
  return {
    id:             b.id,
    business_name:  b.business_name,
    slug:           b.slug,
    business_type:  b.business_type,
    service_for:    b.service_for,
    city:           b.city,
    state:          b.state,
    logo_url:       b.logo_url       ?? null,
    is_active:      b.is_active,
    average_rating: b.average_rating ?? 0,
    total_reviews:  b.total_reviews  ?? 0,
    _count: {
  staff: b._count.staff,
  bookings: b._count.bookings,
},
    owner: {
      id:    b.owner.id,
      name:  b.owner.name,
      email: b.owner.user.email,
    },
    created_at: toTZDate(b.created_at),
    earnings: {
  total_inr:
    (b.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) ?? 0) / 100,
},
  };
}

export class AdminBusinessesService {

  static async getBusinesses(opts: {
    search?:   string;
    city?:     string;
    state?:    string;
    is_active?: boolean;
    page:      number;
    limit:     number;
  }) {
    const { businesses, total } = await AdminBusinessesRepository.find({
      search:    opts.search,
      city:      opts.city,
      state:     opts.state,
      is_active: opts.is_active,
      skip:      (opts.page - 1) * opts.limit,
      take:      opts.limit,
    });

    return {
      businesses: businesses.map(toListItem),
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getBusinessDetail(businessId: string) {
    const b = await AdminBusinessesRepository.findById(businessId);
    if (!b) throw new NotFoundError("Business not found.");
    

    // Compute earnings from Payment table (source of truth — no wallet)
const { prisma } = await import("../../../config/prisma");

const [total, completed, noShow] = await Promise.all([

  // ✅ TOTAL EARNINGS (ONLY VALID MONEY)
  prisma.payment.aggregate({
    where: {
      business_id: businessId,

      status: { in: ["PAID", "SETTLED"] },

      refund_status: "NONE", // ✅ STRICT FIX

      booking: {
        status: {
          in: ["COMPLETED", "NO_SHOW"], // ✅ ONLY VALID BOOKINGS
        },
      },
    },
    _sum: { amount: true },
  }),

  // ✅ COMPLETED EARNINGS
  prisma.payment.aggregate({
    where: {
      business_id: businessId,

      status: { in: ["PAID", "SETTLED"] },

      refund_status: "NONE",

      booking: {
        status: "COMPLETED",
      },
    },
    _sum: { amount: true },
  }),

  // ✅ NO SHOW EARNINGS
  prisma.payment.aggregate({
    where: {
      business_id: businessId,

      status: { in: ["PAID", "SETTLED"] },

      refund_status: "NONE",

      booking: {
        status: "NO_SHOW",
      },
    },
    _sum: { amount: true },
  }),

]);


    return {
      ...toListItem(b),
      description:        b.description        ?? null,
      address_line1:      b.address_line1,
      address_line2:      b.address_line2       ?? null,
      pincode:            b.pincode,
      latitude:           b.latitude            ?? null,
      longitude:          b.longitude           ?? null,
      map_link:           b.map_link            ?? null,
      business_email:     b.business_email      ?? null,
      business_phone:     b.business_phone      ?? null,
      website_url:        b.website_url         ?? null,
      break_time_minutes: b.break_time_minutes,
      earnings: {
  total_inr:      (total._sum.amount ?? 0) / 100,        // ₹1900
  completed_inr:  (completed._sum.amount ?? 0) / 100,    // ₹1600
  no_show_inr:    (noShow._sum.amount ?? 0) / 100,       // ₹300
},
      owner: {
        id:      b.owner.id,
        name:    b.owner.name,
        phone:   b.owner.phone  ?? null,
        email:   b.owner.user.email,
        user_id: b.owner.user.id,
      },
      images: (b.images ?? []).map((img: any) => ({
        id:         img.id,
        image_url:  img.image_url,
        is_primary: img.is_primary,
      })),
      schedules: (b.schedules ?? []).map((sc: any) => ({
        day_of_week: sc.day_of_week,
        is_open:     sc.is_open,
        open_time:   sc.open_time  ?? null,
        close_time:  sc.close_time ?? null,
      })),
      staff: (b.staff ?? []).map((s: any) => ({
  id:             s.id,
  name:           s.name,
  email:          s.email,
  avatar_url:     s.avatar_url ?? null, // ✅ FIX
  average_rating: s.average_rating ?? 0,
  total_reviews:  s.total_reviews  ?? 0,
})),

services: (b.services ?? []).map((svc: any) => ({
  id: svc.id,
  price: svc.price,
  discounted_price: svc.discounted_price,
  platform_service: svc.platform_service,
})),
    };
  }

  static async getBusinessReviews(
  businessId: string,
  opts: { page: number; limit: number; rating?: number }
) {
  const { prisma } = await import("../../../config/prisma");

  const where: any = {
    booking: {
      business_id: businessId, // ✅ IMPORTANT FIX
    },
  };

  if (opts.rating) {
    where.rating = opts.rating;
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        booking: {
          include: {
            customer: {
              select: { name: true, avatar_url: true },
            },
            staff: {
              select: { name: true, avatar_url: true },
            },
          
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),

    prisma.review.count({ where }),
  ]);

  // Collect all service_ids from booking.services JSON
  const allServiceIds = new Set<string>();
  reviews.forEach((r: any) => {
    if (Array.isArray(r.booking?.services)) {
      r.booking.services.forEach((s: any) => {
        if (s?.service_id) allServiceIds.add(s.service_id);
      });
    }
  });

  // Fetch service names in one query
  const serviceRows = await prisma.businessServiceOffering.findMany({
    where: { id: { in: Array.from(allServiceIds) } },
    include: { platform_service: { select: { name: true } } },
  });
  const serviceLookup = new Map(
    serviceRows.map((s: any) => [s.id, s.platform_service.name])
  );

  return {
    reviews: reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,

      customer_name: r.booking?.customer?.name,
      customer_avatar: r.booking?.customer?.avatar_url,

      staff_name: r.booking?.staff?.name,
      staff_avatar: r.booking?.staff?.avatar_url,

      services: Array.isArray(r.booking?.services)
        ? r.booking.services.map((s: any) => serviceLookup.get(s.service_id)).filter(Boolean)
        : [],

      images: r.images ?? [],
      business_response: r.business_response ?? null,
    })),

    pagination: {
      total,
      page: opts.page,
      limit: opts.limit,
      total_pages: Math.ceil(total / opts.limit),
    },
  };
}
}
