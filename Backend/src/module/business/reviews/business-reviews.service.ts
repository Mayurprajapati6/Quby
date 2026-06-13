import { BusinessReviewsRepository } from "./business-reviews.repository";
import { ConflictError, NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import type { BusinessReviewItemDTO } from "../../review/review.types";

const TZ = "Asia/Kolkata";
function toTZ(d: Date)     { return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toTZDate(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM-dd"); }

function toDTO(r: any): BusinessReviewItemDTO {
  return {
    id:      r.id,
    rating:  r.rating,
    comment: r.comment ?? null,
    images:  Array.isArray(r.images) ? r.images : [],
    business_response:    r.business_response    ?? null,
    business_response_at: r.business_response_at ? toTZ(r.business_response_at) : null,
    is_verified: r.is_verified,
    created_at:  toTZ(r.created_at),
    customer: {
      id:         r.customer.id,
      name:       r.customer.name,
      avatar_url: r.customer.avatar_url ?? null,
    },
    // Which staff member this review is about
    staff: {
      id:         r.staff.id,
      name:       r.staff.name,
      avatar_url: r.staff.avatar_url ?? null,
    },
    booking: {
      id:             r.booking.id,
      booking_number: r.booking.booking_number,
      service_date:   toTZDate(r.booking.service_date),
      services:       Array.isArray(r.booking.services)
        ? r.booking.services.map((s: any) => s.name ?? "") : [],
    },
  };
}

export class BusinessReviewsService {

  // All reviews for this business; pass staff_id to filter by staff member
  static async getReviews(
    businessId: string,
    opts: { rating?: number; staff_id?: string; page: number; limit: number },
  ) {
    const [{ reviews, total }, summary] = await Promise.all([
      BusinessReviewsRepository.find(businessId, {
        rating:   opts.rating,
        staff_id: opts.staff_id,
        skip:     (opts.page - 1) * opts.limit,
        take:     opts.limit,
      }),
      BusinessReviewsRepository.getSummary(businessId),
    ]);

    return {
      summary,
      reviews: reviews.map(toDTO),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  // Business responds to a review (one response per review)
  static async respondToReview(
    reviewId:   string,
    businessId: string,
    response:   string,
  ) {
    const review = await BusinessReviewsRepository.findById(reviewId, businessId);
    if (!review) throw new NotFoundError("Review not found.");
    if (review.business_response) throw new ConflictError("You have already responded to this review.");

    await BusinessReviewsRepository.addResponse(reviewId, response);
    return { message: "Response added." };
  }
}
