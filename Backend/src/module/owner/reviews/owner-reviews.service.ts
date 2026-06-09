import { prisma } from "../../../config/prisma";
import { OwnerReviewsRepository } from "./owner-reviews.repository";
import { NotFoundError, BadRequestError, ConflictError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const TZ = "Asia/Kolkata";
function toTZ(d: Date)     { return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toTZDate(d: Date) { return formatInTimeZone(d, TZ, "yyyy-MM-dd"); }

function toDTO(r: any) {
  
  return {
    
    id:               r.id,
    booking_number:   r.booking.booking_number,
    business_name:    r.business.business_name,
     business_logo:    r.business.logo_url ?? null, // ✅ NEW
    customer_name:    r.customer.name,
    customer_avatar:  r.customer.avatar_url ?? null,
    staff_id:         r.staff.id,
    staff_name:       r.staff.name,
    staff_avatar:     r.staff.avatar_url ?? null,
    service_date:     toTZDate(r.booking.service_date),
    services: Array.isArray(r.booking.services)
  ? r.booking.services.map((s: any) => ({
      name: typeof s === "string" ? s : s?.name ?? "",
      image: s?.image ?? s?.image_url ?? null, // ✅ FIXED
    }))
  : [],
    rating:           r.rating,
    comment:          r.comment           ?? null,
    images:           Array.isArray(r.images) ? r.images : [],
    business_response:    r.business_response    ?? null,
    business_response_at: r.business_response_at ? toTZ(r.business_response_at) : null,
    is_verified:      r.is_verified,
    created_at:       toTZ(r.created_at),
  };
}

export class OwnerReviewsService {

  private static async getBusinessIds(userId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");
    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    return businesses.map(b => b.id);
  }

  // All reviews across all owner's businesses — pass staff_id or business_id to filter
  static async getReviews(
    userId: string,
    opts: {
      business_id?: string;
      staff_id?:    string;
      rating?:      number;
      page:         number;
      limit:        number;
    },
  ) {
    const businessIds = await this.getBusinessIds(userId);
    const { reviews, total } = await OwnerReviewsRepository.find({ businessIds, ...opts });

    return {
      reviews: reviews.map(toDTO),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  // Respond to a review on behalf of a business
  static async respondToReview(userId: string, reviewId: string, response: string) {
    const businessIds = await this.getBusinessIds(userId);
    const review      = await OwnerReviewsRepository.findById(reviewId, businessIds);
    if (!review) throw new NotFoundError("Review not found.");
    if (review.business_response) throw new ConflictError("A response has already been submitted.");
    if (!response.trim())         throw new BadRequestError("Response text is required.");

    const updated = await OwnerReviewsRepository.addBusinessResponse(reviewId, response.trim());
    return {
      review_id:            updated.id,
      business_response:    updated.business_response,
      business_response_at: updated.business_response_at ? toTZ(updated.business_response_at) : null,
    };
  }
}
