import { prisma } from "../../../config/prisma";
import { OwnerReviewsRepository } from "./owner-reviews.repository";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toIST(d: Date)     { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

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

  static async getBusinessReviews(
    userId: string,
    opts: {
      business_id?: string;
      rating?:      number;
      page:         number;
      limit:        number;
    },
  ) {
    const businessIds = await this.getBusinessIds(userId);
    const { reviews, total } = await OwnerReviewsRepository.findBusinessReviews({
      businessIds, ...opts,
    });

    return {
      reviews: reviews.map(r => ({
        id:                   r.id,
        booking_number:       r.booking.booking_number,
        business_name:        r.business.business_name,
        customer_name:        r.customer.name,
        customer_avatar:      r.customer.avatar_url ?? null,
        staff_name:           r.staff.name,
        service_date:         toISTDate(r.booking.service_date),
        business_rating:      r.business_rating,
        staff_rating:         r.staff_rating,
        overall_rating:       r.overall_rating,
        business_comment:     r.business_comment     ?? null,
        staff_comment:        r.staff_comment        ?? null,
        images:               Array.isArray(r.images) ? r.images : [],
        business_response:    r.business_response    ?? null,
        business_response_at: r.business_response_at ? toIST(r.business_response_at) : null,
        staff_response:       r.staff_response       ?? null,
        staff_response_at:    r.staff_response_at    ? toIST(r.staff_response_at)    : null,
        is_verified:          r.is_verified,
        created_at:           toIST(r.created_at),
      })),
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getStaffReviews(
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
    const { reviews, total } = await OwnerReviewsRepository.findStaffReviews({
      businessIds, ...opts,
    });

    return {
      reviews: reviews.map(r => ({
        id:               r.id,
        booking_number:   r.booking.booking_number,
        customer_name:    r.customer.name,
        customer_avatar:  r.customer.avatar_url  ?? null,
        staff_id:         r.staff.id,
        staff_name:       r.staff.name,
        staff_avatar:     r.staff.avatar_url     ?? null,
        service_date:     toISTDate(r.booking.service_date),
        staff_rating:     r.staff_rating,
        overall_rating:   r.overall_rating,
        staff_comment:    r.staff_comment        ?? null,
        images:           Array.isArray(r.images) ? r.images : [],
        staff_response:   r.staff_response       ?? null,
        staff_response_at: r.staff_response_at   ? toIST(r.staff_response_at) : null,
        is_verified:      r.is_verified,
        created_at:       toIST(r.created_at),
      })),
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async respondToReview(userId: string, reviewId: string, response: string) {
    const businessIds = await this.getBusinessIds(userId);
    const review      = await OwnerReviewsRepository.findById(reviewId, businessIds);
    if (!review) throw new NotFoundError("Review not found.");

    if (review.business_response) {
      throw new ConflictError("A response has already been submitted for this review.");
    }
    if (!response.trim()) {
      throw new BadRequestError("Response text is required.");
    }

    const updated = await OwnerReviewsRepository.addBusinessResponse(reviewId, response.trim());

    return {
      review_id:            updated.id,
      business_response:    updated.business_response,
      business_response_at: updated.business_response_at
        ? toIST(updated.business_response_at)
        : null,
    };
  }
}
