import { prisma } from "../../../config/prisma";
import { StaffReviewsRepository } from "./staff-reviews.repository";
import { NotFoundError, ForbiddenError, ConflictError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toIST(d: Date)     { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

async function resolveStaff(userId: string) {
  const s = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, is_active: true },
  });
  if (!s)           throw new NotFoundError("Staff profile not found.");
  if (!s.is_active) throw new ForbiddenError("Your account has been deactivated.");
  return s;
}

function toReviewDTO(r: any) {
  return {
    id:                   r.id,
    staff_rating:         r.staff_rating,
    business_rating:      r.business_rating,
    overall_rating:       r.overall_rating,
    staff_comment:        r.staff_comment       ?? null,
    images:               Array.isArray(r.images) ? r.images : [],
    staff_response:       r.staff_response       ?? null,
    staff_response_at:    r.staff_response_at    ? toIST(r.staff_response_at) : null,
    business_response:    r.business_response    ?? null,
    business_response_at: r.business_response_at ? toIST(r.business_response_at) : null,
    created_at: toIST(r.created_at),
    customer: {
      id:         r.customer.id,
      name:       r.customer.name,
      avatar_url: r.customer.avatar_url ?? null,
    },
    booking: {
      id:             r.booking.id,
      booking_number: r.booking.booking_number,
      service_date:   toISTDate(r.booking.service_date),
      services:       Array.isArray(r.booking.services)
        ? r.booking.services.map((s: any) => s.name ?? "") : [],
    },
  };
}

export class StaffReviewsService {

  static async getReviews(userId: string, opts: { rating?: number; page: number; limit: number }) {
    const staff = await resolveStaff(userId);
    const { reviews, total } = await StaffReviewsRepository.find(staff.id, {
      rating: opts.rating,
      skip:   (opts.page - 1) * opts.limit,
      take:   opts.limit,
    });

    return {
      reviews: reviews.map(toReviewDTO),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async respondToReview(userId: string, reviewId: string, response: string) {
    const staff  = await resolveStaff(userId);
    const review = await StaffReviewsRepository.findById(reviewId, staff.id);
    if (!review) throw new NotFoundError("Review not found.");
    if (review.staff_response) throw new ConflictError("You have already responded to this review.");

    await StaffReviewsRepository.addResponse(reviewId, response);
    return { message: "Response published." };
  }
}
