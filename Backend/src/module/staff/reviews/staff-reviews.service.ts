import { prisma } from "../../../config/prisma";
import { StaffReviewsRepository } from "./staff-reviews.repository";
import { NotFoundError, ForbiddenError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import type { StaffReviewItemDTO } from "../../review/review.types";

const TZ = "Asia/Kolkata";
function toTZ(d: Date)     { return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toTZDate(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM-dd"); }

async function resolveStaff(userId: string) {
  const s = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, is_active: true },
  });
  if (!s)           throw new NotFoundError("Staff profile not found.");
  if (!s.is_active) throw new ForbiddenError("Your account has been deactivated.");
  return s;
}

function toDTO(r: any): StaffReviewItemDTO {
  return {
    id:      r.id,
    rating:  r.rating,
    comment: r.comment ?? null,
    images:  Array.isArray(r.images) ? r.images : [],
    business_response:    r.business_response    ?? null,
    business_response_at: r.business_response_at ? toTZ(r.business_response_at) : null,
    created_at: toTZ(r.created_at),
    customer: {
      id:         r.customer.id,
      name:       r.customer.name,
      avatar_url: r.customer.avatar_url ?? null,
    },
    booking: {
      id:             r.booking.id,
      booking_number: r.booking.booking_number,
      service_date:   toTZDate(r.booking.service_date),
      services: Array.isArray(r.booking.services)
  ? r.booking.services.map((s: any) => ({
      name: typeof s === "string" ? s : s?.name ?? "",
      image: s?.image ?? s?.image_url ?? null,
    }))
  : [],
    },
  };
}

export class StaffReviewsService {

  // All reviews for this staff member
  static async getReviews(userId: string, opts: { rating?: number; page: number; limit: number }) {
    const staff = await resolveStaff(userId);
    const { reviews, total } = await StaffReviewsRepository.find(staff.id, {
      rating: opts.rating,
      skip:   (opts.page - 1) * opts.limit,
      take:   opts.limit,
    });

    const summary = await StaffReviewsRepository.getSummary(staff.id);

    return {
      summary,
      reviews: reviews.map(toDTO),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }
}
