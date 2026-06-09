import { AdminUsersRepository } from "./admin-users.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";


const TZ = "Asia/Kolkata";
function toTZ(d: Date)  { return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toTZDate(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM-dd"); }

export class AdminUsersService {

  static async getOwners(opts: {
    search?: string;
    city?:   string;
    state?:  string;
    page:    number;
    limit:   number;
  }) {
    const { owners, total } = await AdminUsersRepository.findOwners({
      search: opts.search,
      city:   opts.city,
      state:  opts.state,
      skip:   (opts.page - 1) * opts.limit,
      take:   opts.limit,
    });

    return {
      owners: owners.map(o => ({
        id:                o.id,
        name:              o.name,
        email:             o.user.email,
        phone:             o.phone        ?? null,
        avatar_url:        o.avatar_url   ?? null,
        city:              o.city,
        state:             o.state,
        total_businesses:  o.total_businesses,
        active_businesses: o.active_businesses,
        business_count:    (o as any)._count.businesses,
        is_active:         o.user.is_active,
        joined_at:         toTZDate(o.created_at),
      })),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async getOwnerDetail(ownerId: string) {
    const o = await AdminUsersRepository.findOwnerById(ownerId);
    if (!o) throw new NotFoundError("Owner not found.");

    return {
      id:                o.id,
      name:              o.name,
      email:             o.user.email,
      phone:             o.phone         ?? null,
      avatar_url:        o.avatar_url    ?? null,
      city:              o.city,
      state:             o.state,
      address_line1:     o.address_line1 ?? null,
      address_line2:     o.address_line2 ?? null,
      personal_info:     o.personal_info ?? null,
      total_businesses:  o.total_businesses,
      active_businesses: o.active_businesses,
      total_staff: (o.businesses ?? []).reduce(
  (sum, b: any) => sum + ((b as any)._count?.staff ?? 0),
  0
),
      is_active:         o.user.is_active,
      joined_at:         toTZDate(o.created_at),
      businesses: (o.businesses ?? []).map((b: any) => ({
        id:             b.id,
        business_name:  b.business_name,
        city:           b.city,
        state:          b.state,
        is_active:      b.is_active,
        is_verified:    b.is_verified,
        average_rating: b.average_rating ?? 0,
        logo_url:       b.logo_url    ?? null,
        service_for:    b.service_for ?? null,
      })),
    };
  }

  static async getCustomers(opts: {
    search?: string;
    city?:   string;
    state?:  string;
    page:    number;
    limit:   number;
  }) {
    const { customers, total } = await AdminUsersRepository.findCustomers({
      search: opts.search,
      city:   opts.city,
      state:  opts.state,
      skip:   (opts.page - 1) * opts.limit,
      take:   opts.limit,
    });

    return {
      customers: customers.map(c => ({
        id:                 c.id,
        username:           c.username,
        name:               c.name,
        email:              c.user.email,
        phone:              c.phone      ?? null,
        avatar_url:         c.avatar_url ?? null,
        city:               c.city,
        state:              c.state,
        total_bookings: (c as any)._count.bookings,
        completed_bookings: c.completed_bookings,
        total_spent_inr:    c.total_spent / 100,
        booking_count:      (c as any)._count.bookings,
        review_count:       (c as any)._count.reviews,
        is_active:          c.user.is_active,
        joined_at:          toTZDate(c.created_at),
      })),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async getCustomerDetail(customerId: string) {
  const c = await AdminUsersRepository.findCustomerById(customerId);
  if (!c) throw new NotFoundError("Customer not found.");

  const { prisma } = await import("../../../config/prisma");

  // ─────────────────────────────────────────────
  // 1. Booking breakdown (SOURCE OF TRUTH)
  // ─────────────────────────────────────────────
  const bookings = await prisma.booking.groupBy({
    by: ["status"],
    where: { customer_id: c.id },
    _count: { _all: true },
  });

  const map: Record<string, number> = {};
  bookings.forEach(b => {
    map[b.status] = b._count._all;
  });

  // ─────────────────────────────────────────────
  // 2. Total bookings (ONLY meaningful)
  // ─────────────────────────────────────────────
  const totalBookings =
  (map.COMPLETED ?? 0) +
  (map.NO_SHOW ?? 0) +
  (map.REFUNDED ?? 0);
  // ─────────────────────────────────────────────
  // 3. Total spent (REAL MONEY ONLY)
  // ─────────────────────────────────────────────
  const spentAgg = await prisma.booking.aggregate({
  where: {
    customer_id: c.id,
    status: { in: ["COMPLETED", "NO_SHOW"] },
  },
  _sum: { service_amount: true },
});

  // ─────────────────────────────────────────────
  // 4. Refunded amount
  // ─────────────────────────────────────────────
  const refundAgg = await prisma.payment.aggregate({
  where: {
    customer_id: c.id,
    refund_status: {
  in: ["PROCESSING", "DONE"] as any,
},
  },
  _sum: { refund_amount: true },
});

  // ─────────────────────────────────────────────
  // FINAL RESPONSE
  // ─────────────────────────────────────────────
  return {
    id: c.id,
    username: c.username,
    name: c.name,
    email: c.user.email,
    phone: c.phone ?? null,
    avatar_url: c.avatar_url ?? null,
    city: c.city,
    state: c.state,
    address_line1: c.address_line1 ?? null,

    // ✅ FIXED METRICS
    total_bookings: totalBookings,
    completed_bookings: map.COMPLETED ?? 0,
    no_show_bookings: map.NO_SHOW ?? 0,
    cancelled_bookings: map.CANCELLED ?? 0,
    refunded_bookings: map.REFUNDED ?? 0,

    total_spent_inr: (spentAgg._sum.service_amount ?? 0) / 100,
    refunded_amount_inr: (refundAgg._sum.refund_amount ?? 0) / 100,

    review_count: (c as any)._count.reviews,
    is_active: c.user.is_active,
    joined_at: toTZDate(c.created_at),
    first_login_at: c.first_login_at ? toTZ(c.first_login_at) : null,
  };
}

  static async getStaff(opts: {
    search?:      string;
    business_id?: string;
    page:         number;
    limit:        number;
  }) {
    const { staff, total } = await AdminUsersRepository.findStaff({
      search:      opts.search,
      business_id: opts.business_id,
      skip:        (opts.page - 1) * opts.limit,
      take:        opts.limit,
    });
    

    return {
      staff: staff.map(s => ({
        id:             s.id,
        name:           s.name,
        email:          s.email,
        phone:          s.phone       ?? null,
        avatar_url:     s.avatar_url  ?? null,
        specialization: s.specialization ?? null,
        average_rating: s.average_rating ?? 0,
        total_reviews:  s.total_reviews  ?? 0,
        is_active:      s.is_active,
        is_verified:    s.is_verified,
        business: {
  id: (s as any).business.id,
  business_name: (s as any).business.business_name,
  city: (s as any).business.city,
  logo_url: (s as any).business.logo_url ?? null,
},
        booking_count: (s as any)._count.bookings,
        review_count:  (s as any)._count.reviews,
        joined_at:     toTZDate(s.created_at),
      })),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async getStaffDetail(staffId: string) {
    const s = await AdminUsersRepository.findStaffById(staffId);
    if (!s) throw new NotFoundError("Staff member not found.");

    const { prisma } = await import("../../../config/prisma");

const completedCount = await prisma.booking.count({
  where: {
    staff_id: s.id,
    status: "COMPLETED",
  },
});

const earningsAgg = await prisma.booking.aggregate({
  where: {
    staff_id: s.id,
    status: "COMPLETED",
  },
  _sum: { service_amount: true },
})

    return {
      id:               s.id,
      name:             s.name,
      email:            s.email,
      phone:            s.phone         ?? null,
      avatar_url:       s.avatar_url    ?? null,
      bio:              s.bio           ?? null,
      specialization:   s.specialization ?? null,
      experience_years: s.experience_years ?? null,
      city:             s.city           ?? null,
      state:            s.state          ?? null,
      average_rating:   s.average_rating  ?? 0,
      total_reviews:    s.total_reviews   ?? 0,
      is_active:        s.is_active,
      is_verified:      s.is_verified,
      business: {
        id:            (s as any).business.id,
        business_name: (s as any).business.business_name,
        city:          (s as any).business.city,
        state:         (s as any).business.state,
      },
      services: (s.services ?? []).map((sv: any) => ({
        name:             sv.service_offering?.platform_service?.name ?? 'Service',
        duration_minutes: sv.duration_minutes,
        is_available:     sv.is_available,
        service_offering: sv.service_offering,
      })),
      schedules: ((s as any).schedules ?? []).map((sc: any) => ({
        day_of_week:  sc.day_of_week,
        is_available: sc.is_available,
        start_time:   sc.start_time ?? null,
        end_time:     sc.end_time   ?? null,
      })),
      completed_bookings: completedCount,
booking_count: (s as any)._count.bookings,
      review_count:  (s as any)._count.reviews,
      leave_count:   (s as any)._count.leaves,
      joined_at:     toTZDate(s.created_at),
      total_earnings_inr: (earningsAgg._sum.service_amount ?? 0) / 100,
    };
  }

  // 🔥 ADD THIS METHOD
static async getStaffReviews(staffId: string) {
  const reviews = await AdminUsersRepository.findStaffReviews(staffId);

  const { prisma } = await import("../../../config/prisma");

  // Collect all service_ids from booking.services JSON
  const allServiceIds = new Set<string>();
  reviews.forEach((r: any) => {
    if (Array.isArray(r.booking?.services)) {
      r.booking.services.forEach((s: any) => {
        if (s?.service_id) allServiceIds.add(s.service_id);
      });
    }
  });

  // Fetch service names + images in one query
  const serviceRows = await prisma.businessServiceOffering.findMany({
    where: { id: { in: Array.from(allServiceIds) } },
    include: { platform_service: { select: { name: true, image_url: true } } },
  });
  const serviceLookup = new Map(
    serviceRows.map((s: any) => [s.id, { name: s.platform_service.name, image_url: s.platform_service.image_url }])
  );

  return reviews.map((r: any) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: toTZ(r.created_at),

    customer: {
      name: r.customer?.name ?? "User",
      avatar_url: r.customer?.avatar_url ?? null,
    },

    services: Array.isArray(r.booking?.services)
      ? r.booking.services
          .map((s: any) => {
            const data = serviceLookup.get(s.service_id);
            return data ? { name: data.name, image_url: data.image_url } : null;
          })
          .filter(Boolean)
      : [],

    images: Array.isArray(r.images) ? r.images : [],
    business_response: r.business_response ?? null,

    service_date: r.booking?.service_date
      ? toTZDate(r.booking.service_date)
      : null,
  }));
}
}