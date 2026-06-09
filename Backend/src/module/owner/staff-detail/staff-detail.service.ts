// ─────────────────────────────────────────────────────────────────────────────
// FILE   : owner/staff-detail/staff-detail.service.ts
// A42    : Complete — owner views full staff detail with period stats
// ─────────────────────────────────────────────────────────────────────────────

import { StaffDetailRepository }   from "./staff-detail.repository";
import { BusinessStaffRepository } from "../business-staff/business-staff.repository";
import { NotFoundError }           from "../../../utils/errors/app.error";
import { formatInTimeZone }        from "date-fns-tz";
import type { StaffDetailDTO }     from "./staff-detail.types";

const IST = "Asia/Kolkata";
function toIST(d: Date)     { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

export class StaffDetailService {

  static async getStaffDetail(
    userId:   string,
    staffId:  string,
    period:   "week" | "month" | "year" = "month",
  ): Promise<StaffDetailDTO> {
    // Ownership check — staff must belong to one of owner's businesses
    const ownerCheck = await BusinessStaffRepository.findByOwnerAndStaff(userId, staffId);
    if (!ownerCheck) throw new NotFoundError("Staff member not found.");

    // All data in parallel
    const [staff, stats, recentBookings, recentReviews] = await Promise.all([
      StaffDetailRepository.findFull(staffId),
      StaffDetailRepository.getPeriodStats(staffId, period),
      StaffDetailRepository.getRecentBookings(staffId, 10),
      StaffDetailRepository.getRecentReviews(staffId, 5),
    ]);

    if (!staff) throw new NotFoundError("Staff member not found.");

    return {
      id:               staff.id,
      name:             staff.name,
      email:            staff.email,
      phone:            staff.phone          ?? null,
      avatar_url:       staff.avatar_url     ?? null,
      bio:              staff.bio            ?? null,
      specialization:   staff.specialization ?? null,
      experience_years: staff.experience_years ?? null,
      business_name:    staff.business.business_name,
      is_active:        staff.is_active,
      setup_complete:   !!(staff as any).setup_complete,
      join_date:        toISTDate(staff.created_at),
      average_rating:   staff.average_rating  ?? 0,
      total_reviews:    staff.total_reviews   ?? 0,

      services: staff.services.map(sv => ({
        id:               sv.service_offering.id,
        name:             sv.service_offering.platform_service.name,
        category:         sv.service_offering.platform_service.category ?? null,
        image_url:        (sv.service_offering.platform_service as any).image_url ?? null,
        duration_minutes: sv.duration_minutes,
        is_available:     sv.is_available,
        price:            sv.service_offering.price,
        discounted_price: sv.service_offering.discounted_price ?? null,
      })),

      schedule: staff.schedules.map(s => ({
        day_of_week:  s.day_of_week,
        is_available: s.is_available,
        start_time:   s.start_time ?? null,
        end_time:     s.end_time   ?? null,
      })),

      stats: {
  ...stats,
  revenue_inr: Math.floor((stats.revenue_inr ?? 0) / 100),
},

      recent_bookings: recentBookings.map(b => ({
        id:             b.id,
        booking_number: b.booking_number,
        service_date:   toISTDate(b.service_date),
        service_start_time: toIST(b.service_start_time),
        customer_name:  b.customer.name,
        services:       Array.isArray((b as any).services) ? (b as any).services.map((s: any) => s.name ?? "") : [],
        status:         b.status as string,
        amount:         (b as any).service_amount ?? 0,
      })),

      recent_reviews: recentReviews.map(r => ({
        id:            r.id,
        customer_name: r.customer.name,
        rating:  r.rating,
        comment:      r.comment      ?? null,
        service_date:  toISTDate(r.booking.service_date),
        created_at:    toIST(r.created_at),
      })),
    };
  }
}