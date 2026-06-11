import { ReviewRepository } from "./review.repository";
import { prisma } from "../../config/prisma";
import { uploadImageBuffer } from "../../utils/helpers/cloudinary";
import { notificationQueue, analyticsQueue } from "../../config/bullmq";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import { add } from "date-fns";
import type {
  SubmitReviewDTO,
  ReviewItemDTO,
  PendingReviewItemDTO,
  MyReviewsResponseDTO,
} from "./review.types";

const TZ = "Asia/Kolkata";
const NOTIF_TTL_DAYS = 30;

function toTZ(date: Date | null | undefined): string | null {
  if (!date) return null;
  return formatInTimeZone(date, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx");
}
function toTZDate(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

function buildCommentPreview(comment: string | undefined): string {
  if (!comment) return "";
  const snippet = comment.length > 80 ? comment.slice(0, 80) + "..." : comment;
  return " \"" + snippet + "\"";
}

function toReviewDTO(r: any): ReviewItemDTO {
  
  return {
    id:                   r.id,
    booking_id:           r.booking_id,
    business_id:          r.business_id,
    staff_id:             r.staff_id,
    rating:               r.rating,
    comment:              r.comment   ?? null,
    images:               Array.isArray(r.images) ? r.images : [],
    business_response:    r.business_response    ?? null,
    business_response_at: toTZ(r.business_response_at),
    is_verified:          r.is_verified,
    created_at:           toTZ(r.created_at)!,
    business_name:        r.business?.business_name ?? "",
    business_logo:        r.business?.logo_url      ?? null,
    staff_name:           r.staff?.name             ?? "",
    staff_avatar:         r.staff?.avatar_url       ?? null,
    services: Array.isArray(r.booking?.services)
  ? r.booking.services.map((s: any) => ({
      name: s?.name ?? "",
      image: s?.image ?? s?.image_url ?? null,
    }))
  : [],
  };
}

export class ReviewService {

  private static async resolveCustomer(userId: string) {
    const c = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true },
    });
    if (!c) throw new NotFoundError("Customer profile not found.");
    return c;
  }

  static async getPendingReviews(userId: string): Promise<PendingReviewItemDTO[]> {
    const customer = await this.resolveCustomer(userId);
    const bookings = await ReviewRepository.findPendingForCustomer(customer.id);

    return bookings.map(b => {


  return {
    booking_id:     b.id,
    booking_number: b.booking_number,
    business_id:    b.business.id,
    business_name:  b.business.business_name,
    business_logo:  b.business.logo_url ?? null,
    staff_id:       b.staff.id,
    staff_name:     b.staff.name,
    staff_avatar:   b.staff.avatar_url ?? null,
    service_date:   toTZDate(b.service_date),

    services: Array.isArray((b as any).services)
      ? (b as any).services.map((s: any) => ({
          name: s?.name ?? "",
          image: s?.image ?? s?.image_url ?? null,
        }))
      : [],
  };
});
  }

  static async submitReview(
    userId:      string,
    dto:         SubmitReviewDTO,
    imageFiles?: Express.Multer.File[],
  ): Promise<ReviewItemDTO> {
    const customer = await this.resolveCustomer(userId);

    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestError("rating must be between 1 and 5.");
    }

    const booking = await prisma.booking.findFirst({
      where:  { id: dto.booking_id, customer_id: customer.id },
      select: {
        id:             true,
        status:         true,
        staff_id:       true,
        business_id:    true,
        service_amount: true,
        staff:    { select: { name: true } },
        business: {
          select: {
            business_name: true,
            owner: { select: { user: { select: { id: true } } } },
          },
        },
      },
    });
    if (!booking) throw new NotFoundError("Booking not found.");
    if (booking.status !== "COMPLETED") {
      throw new BadRequestError("Reviews can only be submitted for completed bookings.");
    }

    const existing = await ReviewRepository.findByBookingId(dto.booking_id);
    if (existing) {
      throw new ConflictError("A review has already been submitted for this booking.");
    }

    const imageUrls: string[] = [];
    if (imageFiles?.length) {
      const results = await Promise.allSettled(
        imageFiles.slice(0, 3).map(f => uploadImageBuffer(f, "REVIEWS"))
      );
      for (const r of results) {
        if (r.status === "fulfilled") imageUrls.push(r.value.secure_url);
      }
    }

    const notifExpiresAt = add(new Date(), { days: NOTIF_TTL_DAYS });

    const review = await ReviewRepository.create({
      booking_id:  dto.booking_id,
      customer_id: customer.id,
      business_id: booking.business_id,
      staff_id:    booking.staff_id,
      rating:      dto.rating,
      comment:     dto.comment ?? null,
      images:      imageUrls,
    });

    const staffName        = booking.staff?.name ?? "";
    const bizName          = booking.business?.business_name ?? "";
    const ownerUserId      = booking.business?.owner?.user?.id;
    const commentPreview   = buildCommentPreview(dto.comment);
    const ratingStars      = dto.rating + "\u2605";

    

    await notificationQueue.add(
  `review-${review.id}`,
  { type: "review-received", reviewId: review.id },
  { jobId: `review-${review.id}` }
);

    await Promise.allSettled([
      ReviewRepository.recalculateStaffRating(booking.staff_id),
      ReviewRepository.recalculateBusinessRating(booking.business_id),
    ]);

    analyticsQueue.add(
      "review-submitted:" + review.id,
      { type: "review-submitted", staffId: booking.staff_id, businessId: booking.business_id },
      { jobId: "analytics:review-submitted:" + review.id },
    ).catch(() => {});

    return toReviewDTO(review);
  }

  static async getMyReviews(
    userId: string,
    opts:   { rating?: number; page: number; limit: number },
  ): Promise<MyReviewsResponseDTO> {
    const customer = await this.resolveCustomer(userId);
    const { reviews, total } = await ReviewRepository.findByCustomer(customer.id, opts);

    return {
      reviews:    reviews.map(toReviewDTO),
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }
}
