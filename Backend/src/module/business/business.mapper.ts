import type { BusinessProfileDTO, BusinessServiceItemDTO, ScheduleItemDTO, HolidayItemDTO } from "./business.types";

export function toBusinessProfileDTO(business: any): BusinessProfileDTO {
  return {
    id:               business.id,
    business_name:    business.business_name,
    slug:             business.slug             ?? "",
    business_type:    business.business_type    ?? "SALON",
    service_for:      business.service_for,
    description:      business.description      ?? null,
    address_line1:    business.address_line1,
    address_line2:    business.address_line2     ?? null,
    city:             business.city,
    state:            business.state,
    pincode:          business.pincode           ?? "",
    map_link:         business.map_link          ?? null,
    latitude:         business.latitude          ?? null,
    longitude:        business.longitude         ?? null,
    business_email:   business.business_email    ?? null,
    business_phone:   business.business_phone    ?? null,
    website_url:      business.website_url       ?? null,
    instagram_url:    business.instagram_url     ?? null,
    facebook_url:     business.facebook_url      ?? null,
    twitter_url:      business.twitter_url       ?? null,
    youtube_url:      business.youtube_url       ?? null,
    whatsapp_number:  business.whatsapp_number   ?? null,
    logo_url:         business.logo_url          ?? null,
    cover_image_url:  business.cover_image_url   ?? null,
    gallery:          (business.images ?? []).map((img: any) => ({
      id:         img.id,
      image_url:  img.image_url,
      is_primary: img.is_primary,
      sort_order: img.sort_order,
      caption:    img.caption ?? null,
    })),
    is_verified:        business.is_verified,
    is_active:          business.is_active,
    average_rating:     business.average_rating  ?? 0,
    total_reviews:      business.total_reviews   ?? 0,
    break_time_minutes:        business.break_time_minutes        ?? 5,
    cancellation_window_hours: business.cancellation_window_hours ?? 2,
    owner_name:         business.owner?.name     ?? "",
    owner_phone:        business.owner?.phone    ?? null,
    owner_avatar:       business.owner?.avatar_url ?? null,
  };
}

export function toServiceItemDTO(service: any): BusinessServiceItemDTO {
  return {
    id: service.id,
    platform_service: {
      id:          service.platform_service.id,
      name:        service.platform_service.name,
      category:    service.platform_service.category  ?? null,
      service_for: service.platform_service.service_for,
    },
    price:            service.price,
    discounted_price: service.discounted_price ?? null,
    is_featured:      service.is_featured,
    is_active:        service.is_active,
    booking_count:    service.booking_count    ?? 0,
  };
}

export function toScheduleItemDTO(schedule: any): ScheduleItemDTO {
  return {
    id:          schedule.id,
    day_of_week: schedule.day_of_week,
    is_open:     schedule.is_open,
    open_time:   schedule.open_time  ?? null,
    close_time:  schedule.close_time ?? null,
  };
}

export function toHolidayItemDTO(holiday: any): HolidayItemDTO {
  return {
    id:                   holiday.id,
    holiday_name:         holiday.holiday_name,
    description:          holiday.description          ?? null,
    start_date:           holiday.start_date,
    end_date:             holiday.end_date,
    applies_to_all_staff: holiday.applies_to_all_staff,
    staff_count:          (holiday as any)._count?.staff_holidays ?? 0,
  };
}