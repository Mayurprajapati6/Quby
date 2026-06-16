import { prisma } from "../../../config/prisma";
import { BusinessDetailRepository } from "./business-detail.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import type {
  PublicBusinessProfileDTO,
  PublicStaffItemDTO,
  PublicReviewItemDTO,
  StaffReviewsPageDTO,
  StaffReviewItemDTO,
} from "./business-detail.types";

const IST = "Asia/Kolkata";

function toIST(date: Date | null | undefined): string | null {
  if (!date) return null;
  return formatInTimeZone(date, IST, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

function todayDowIST(): string {
  return formatInTimeZone(new Date(), IST, "EEEE").toUpperCase();
}

function checkIsOpenNow(
  schedules: Array<{ day_of_week: string; is_open: boolean; open_time: string | null; close_time: string | null }>
): boolean {
  const dow   = todayDowIST();
  const sched = schedules.find(s => s.day_of_week === dow);
  if (!sched?.is_open || !sched.open_time || !sched.close_time) return false;

  const timeStr = formatInTimeZone(new Date(), IST, "HH:mm");
  const [hours, minutes] = timeStr.split(":").map(Number);
  const nowM = hours * 60 + minutes;
  const [oh, om] = sched.open_time.split(":").map(Number);
  const [ch, cm] = sched.close_time.split(":").map(Number);
  return nowM >= oh * 60 + om && nowM < ch * 60 + cm;
}

export class BusinessDetailService {

  static async getBusinessProfile(
    slug:              string,
    customerProfileId?: string,   
    reviewRating?:     number,    
    reviewPage  = 1,
    reviewLimit = 20,
  ): Promise<PublicBusinessProfileDTO> {

    const business = await BusinessDetailRepository.findBySlug(slug);
    if (!business || !business.is_active || !business.is_verified) {
      throw new NotFoundError("Business not found.");
    }

    const staffIds = business.staff.map(s => s.id);

    const [
      { reviews, total: reviewTotal },
      leaveStaffIds,
      busyStaffIds,
      holiday,
    ] = await Promise.all([
      BusinessDetailRepository.findReviews(business.id, {
        rating: reviewRating,
        page:   reviewPage,
        limit:  reviewLimit,
      }),
      BusinessDetailRepository.findStaffOnLeaveToday(staffIds),
      BusinessDetailRepository.findBusyStaffNow(staffIds),
      BusinessDetailRepository.findHolidayToday(business.id),
    ]);

    const isHolidayToday = holiday?.applies_to_all_staff ?? false;

    const staffItems: PublicStaffItemDTO[] = business.staff.map(s => {
      const isOff  = leaveStaffIds.has(s.id) || isHolidayToday;
      const isBusy = busyStaffIds.has(s.id);

      return {
        id:               s.id,
        name:             s.name,
        avatar_url:       s.avatar_url       ?? null,
        specialization:   s.specialization   ?? null,
        experience_years: s.experience_years ?? null,
        bio:              s.bio              ?? null,
        average_rating:   s.average_rating   ?? 0,
        total_reviews:    s.total_reviews    ?? 0,
        status:           isOff ? "OFF" : isBusy ? "BUSY" : "FREE",

        services: s.services.map(sv => ({
          offering_id:      sv.service_offering.id,
          name:             sv.service_offering.platform_service.name,
          duration_minutes: sv.duration_minutes,
        })),
      };
    });

   const allServiceIds = new Set<string>();

reviews.forEach((r: any) => {
  if (Array.isArray(r.booking?.services)) {
    r.booking.services.forEach((s: any) => {
      if (s?.service_id) {
        allServiceIds.add(s.service_id);
      }
    });
  }
});

// 🔥 FETCH ALL SERVICES FROM DB
const serviceMap = await prisma.businessServiceOffering.findMany({
  where: {
    id: { in: Array.from(allServiceIds) },
  },
  include: {
    platform_service: true,
  },
});

// 🔥 CREATE LOOKUP MAP
const serviceLookup = new Map(
  serviceMap.map(s => [
    s.id,
    {
      name: s.platform_service.name,
      image_url: s.platform_service.image_url,
    },
  ])
);

// 🔥 FINAL MAPPING
const items: PublicReviewItemDTO[] = reviews.map((r: any) => ({
  id: r.id,
  rating: r.rating,
  comment: r.comment ?? null,

  images: Array.isArray(r.images) ? r.images : [],

  services: Array.isArray(r.booking?.services)
    ? r.booking.services.map((s: any) => {
        const data = serviceLookup.get(s.service_id);
        return {
          name: data?.name ?? "Service",
          image_url: data?.image_url ?? null,
        };
      })
    : [],

  business_response: r.business_response ?? null,
  business_response_at: r.business_response_at
    ? toIST(r.business_response_at)
    : null,

  created_at: toIST(r.created_at)!,

  customer: {
    name: r.customer.name,
    avatar_url: r.customer.avatar_url ?? null,
  },

  staff: {
    id: r.staff.id,
    name: r.staff.name,
    avatar_url: r.staff.avatar_url ?? null,
  },
}));

    const ratingCounts = { five: 0, four: 0, three: 0, two: 0, one: 0 };
    reviews.forEach((r: any) => {
      if      (r.rating === 5) ratingCounts.five++;
      else if (r.rating === 4) ratingCounts.four++;
      else if (r.rating === 3) ratingCounts.three++;
      else if (r.rating === 2) ratingCounts.two++;
      else if (r.rating === 1) ratingCounts.one++;
    });

    const todayDow   = todayDowIST();
    const todaySched = business.schedules.find(s => s.day_of_week === todayDow) ?? null;

    const primaryImg = business.images.find(i => i.is_primary)?.image_url
      ?? business.images[0]?.image_url
      ?? business.logo_url
      ?? null;

      

    return {
      id:             business.id,
      slug:           business.slug,
      business_name:  business.business_name,
      owner_name:     (business as any).owner?.name ?? "",
      service_for:    business.service_for,
      description:    business.description   ?? null,

      address_line1:  business.address_line1,
      address_line2:  business.address_line2 ?? null,
      city:           business.city,
      state:          business.state,
      pincode:        business.pincode,
      latitude:       business.latitude      ?? null,
      longitude:      business.longitude     ?? null,
      map_link:       (business as any).map_link ?? null,

      business_phone: business.business_phone ?? null,
      business_email: business.business_email ?? null,
      website_url:    business.website_url    ?? null,

      social_links: {
        instagram: (business as any).instagram_url    ?? null,
        facebook:  (business as any).facebook_url     ?? null,
        twitter:   (business as any).twitter_url      ?? null,
        youtube:   (business as any).youtube_url      ?? null,
        whatsapp:  (business as any).whatsapp_number  ?? null,
      },

      primary_image:   primaryImg,
      gallery: business.images.map(img => ({
        id:         img.id,
        image_url:  img.image_url,
        sort_order: img.sort_order,
        is_primary: img.is_primary,
      })),

      average_rating:  business.average_rating ?? 0,
      total_reviews:   business.total_reviews  ?? 0,
      is_open_now:     checkIsOpenNow(business.schedules as any),

      schedules: business.schedules.map(s => ({
        day_of_week: s.day_of_week,
        is_open:     s.is_open,
        open_time:   s.open_time  ?? null,
        close_time:  s.close_time ?? null,
      })),

      todays_schedule: todaySched
        ? {
            day_of_week: todaySched.day_of_week,
            is_open:     todaySched.is_open,
            open_time:   todaySched.open_time  ?? null,
            close_time:  todaySched.close_time ?? null,
          }
        : null,

      

      services: business.services.map(s => ({
        id:               s.id,
        name:             s.platform_service.name,
        service_for:      s.platform_service.service_for,
        image_url:        (s.platform_service as any).image_url ?? null,
        price:            s.price,
        discounted_price: s.discounted_price ?? null,
        is_featured:      s.is_featured,
      })),

      staff:    staffItems,
      reviews:  items,

      review_summary: {
        average_rating:   business.average_rating ?? 0,
        total_reviews:    business.total_reviews  ?? 0,
        rating_breakdown: ratingCounts,
      },
    };
  }

  static async getStaffReviews(
    slug:    string,
    staffId: string,
    opts: { rating?: number; page: number; limit: number }
  ): Promise<StaffReviewsPageDTO> {

    const business = await prisma.business.findUnique({
      where:  { slug },
      select: { id: true },
    });
    if (!business) throw new NotFoundError("Business not found.");

    const staff = await BusinessDetailRepository.findStaffWithProfile(staffId, business.id);
    if (!staff) throw new NotFoundError("Staff member not found.");

    const { reviews, total } = await BusinessDetailRepository.findStaffReviews(staffId, opts);

    const allServiceIds = new Set<string>();

reviews.forEach((r: any) => {
  if (Array.isArray(r.booking?.services)) {
    r.booking.services.forEach((s: any) => {
      if (s?.service_id) {
        allServiceIds.add(s.service_id);
      }
    });
  }
});

const serviceMap = await prisma.businessServiceOffering.findMany({
  where: {
    id: { in: Array.from(allServiceIds) },
  },
  include: {
    platform_service: {
      select: {
        name: true,
        image_url: true,
      },
    },
  },
});

const serviceLookup = new Map<
  string,
  { name: string; image_url: string | null }
>(
  serviceMap.map((s: any) => [
    s.id,
    {
      name: s.platform_service.name,
      image_url: s.platform_service.image_url,
    },
  ])
);

const items: StaffReviewItemDTO[] = reviews.map((r: any) => ({
  id: r.id,
  rating: r.rating,
  comment: r.comment ?? null,

  images: Array.isArray(r.images) ? r.images : [],

  services: Array.isArray(r.booking?.services)
    ? r.booking.services.map((s: any) => {
        const data = serviceLookup.get(s.service_id);
        return {
          name: data?.name ?? "Service",
          image_url: data?.image_url ?? null,
        };
      })
    : [],

  created_at: toIST(r.created_at)!,

  business_response: r.business_response ?? null,
  business_response_at: r.business_response_at ? toIST(r.business_response_at) : null,

  customer: {
    name: r.customer.name,
    avatar_url: r.customer.avatar_url ?? null,
  },
}));

    return {
      staff_id:       staff.id,
      staff_name:     staff.name,
      staff_avatar:   staff.avatar_url ?? null,
      average_rating: staff.average_rating ?? 0,
      total_reviews:  staff.total_reviews  ?? 0,
      reviews:        items,
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }
}