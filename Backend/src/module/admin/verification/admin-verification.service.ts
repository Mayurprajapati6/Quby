import { AdminVerificationRepository } from "./admin-verification.repository";
import { queueEmail } from "../../../services/email.services";
import { emitToUser } from "../../../socket/socket.service";
import { NotFoundError, BadRequestError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import logger from "../../../config/logger.config";


const IST = "Asia/Kolkata";
function toIST(d: Date)     { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

function toVerificationItem(b: any) {
  return {
    id:             b.id,
    business_name:  b.business_name,
    slug:           b.slug,
    business_type:  b.business_type,
    service_for:    b.service_for,
    city:           b.city,
    state:          b.state,
    logo_url:       b.logo_url        ?? null,
    description:    b.description     ?? null,
    address_line1:  b.address_line1,
    pincode:        b.pincode,
    business_email: b.business_email  ?? null,
    business_phone: b.business_phone  ?? null,
    website_url:    b.website_url     ?? null,
    is_verified:    b.is_verified,
    is_active:      b.is_active,
    verification_note: b.verification_note ?? null,
    staff_count:    b._count?.staff ?? 0,
    submitted_at:   toISTDate(b.created_at),
    owner: {
      id:    b.owner.id,
      name:  b.owner.name,
      phone: b.owner.phone  ?? null,
      email: b.owner.user.email,
    },
    images: (b.images ?? []).map((img: any) => ({
      id:         img.id,
      image_url:  img.image_url,
      is_primary: img.is_primary,
    })),
    services: (b.services ?? []).map((sv: any) => ({
      id:       sv.id,
      name:     sv.platform_service.name,
      category: sv.platform_service.category ?? null,
    })),
  };
}

export class AdminVerificationService {

  static async getPendingBusinesses(opts: { page: number; limit: number }) {
    const { businesses, total } = await AdminVerificationRepository.findPending({
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    });

    return {
      businesses: businesses.map(toVerificationItem),
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getBusinessForReview(businessId: string) {
    const b = await AdminVerificationRepository.findById(businessId);
    if (!b) throw new NotFoundError("Business not found.");

    return {
      ...toVerificationItem(b),
      schedules: (b.schedules ?? []).map((sc: any) => ({
        day_of_week:  sc.day_of_week,
        is_available: sc.is_available,
        open_time:    sc.open_time  ?? null,
        close_time:   sc.close_time ?? null,
      })),
      staff: (b.staff ?? []).map((s: any) => ({
        id:    s.id,
        name:  s.name,
        email: s.email,
      })),
    };
  }

  static async approveVerification(businessId: string) {
    const b = await AdminVerificationRepository.findById(businessId);
    if (!b) throw new NotFoundError("Business not found.");
    if (b.is_verified) throw new BadRequestError("Business is already verified.");

    await AdminVerificationRepository.approve(businessId);

    await AdminVerificationRepository.createNotification(
      businessId,
      "BUSINESS_VERIFIED",
      "Business Verified! 🎉",
      `Congratulations! ${b.business_name} has been verified and is now live on QueueEase.`,
      "BOTH",
    );

    const ownerUserId = b.owner.user.id;
    emitToUser(ownerUserId, "business:approved", { businessId, businessName: b.business_name });

    queueEmail({
      to:   b.owner.user.email,
      type: "business-verified",
      data: { businessName: b.business_name, ownerName: b.owner.name, dashboardUrl: `${process.env.CLIENT_URL}/owner/dashboard`, approvedAt: new Date().toISOString() },
    }).catch(err => logger.warn("[Verification] Approve email failed:", err));

    return { message: "Business verified." };
  }

  static async rejectVerification(businessId: string, reason: string) {
    const b = await AdminVerificationRepository.findById(businessId);
    if (!b) throw new NotFoundError("Business not found.");
    if (b.is_verified) throw new BadRequestError("Business is already verified — cannot reject.");

    await AdminVerificationRepository.reject(businessId, reason);

    await AdminVerificationRepository.createNotification(
      businessId,
      "BUSINESS_REJECTED",
      "Verification Unsuccessful",
      `Your business "${b.business_name}" was not approved. Reason: ${reason}`,
      "OWNER",
    );

    emitToUser(b.owner.user.id, "business:rejected", { businessId, reason });

    queueEmail({
      to:   b.owner.user.email,
      type: "business-rejected",
      data: { businessName: b.business_name, ownerName: b.owner.name, rejectionReason: reason, dashboardUrl: `${process.env.CLIENT_URL}/owner/dashboard` },
    }).catch(err => logger.warn("[Verification] Reject email failed:", err));

    return { message: "Business verification rejected." };
  }
}
