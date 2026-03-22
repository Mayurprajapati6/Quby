import { AdminBusinessesRepository } from "./admin-businesses.repository";
import { queueEmail } from "../../../services/email.services";
import { emitToUser } from "../../../socket/socket.service";
import { NotFoundError, BadRequestError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import logger from "../../../config/logger.config";

const IST = "Asia/Kolkata";
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

function toListItem(b: any) {
  return {
    id:             b.id,
    business_name:  b.business_name,
    slug:           b.slug,
    business_type:  b.business_type,
    service_for:    b.service_for,
    city:           b.city,
    state:          b.state,
    logo_url:       b.logo_url       ?? null,
    is_verified:    b.is_verified,
    is_active:      b.is_active,
    verified_at:    b.verified_at    ? toISTDate(b.verified_at) : null,
    average_rating: b.average_rating ?? 0,
    total_reviews:  b.total_reviews  ?? 0,
    staff_count:    b._count.staff,
    booking_count:  b._count.bookings,
    owner: {
      id:    b.owner.id,
      name:  b.owner.name,
      email: b.owner.user.email,
    },
    auth_suspended: b.auth_user?.is_suspended ?? false,
    created_at:     toISTDate(b.created_at),
  };
}

export class AdminBusinessesService {

  static async getBusinesses(opts: {
    search?:         string;
    city?:           string;
    state?:          string;
    is_verified?:    boolean;
    is_active?:      boolean;
    auth_suspended?: boolean;  
    page:            number;
    limit:           number;
  }) {
    const { businesses, total } = await AdminBusinessesRepository.find({
      search:         opts.search,
      city:           opts.city,
      state:          opts.state,
      is_verified:    opts.is_verified,
      is_active:      opts.is_active,
      auth_suspended: opts.auth_suspended,
      skip:           (opts.page - 1) * opts.limit,
      take:           opts.limit,
    });

    return {
      businesses: businesses.map(toListItem),
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getBusinessDetail(businessId: string) {
    const b = await AdminBusinessesRepository.findById(businessId);
    if (!b) throw new NotFoundError("Business not found.");

    return {
      ...toListItem(b),
      description:        b.description        ?? null,
      address_line1:      b.address_line1,
      address_line2:      b.address_line2       ?? null,
      pincode:            b.pincode,
      latitude:           b.latitude            ?? null,
      longitude:          b.longitude           ?? null,
      map_link:           b.map_link            ?? null,
      business_email:     b.business_email      ?? null,
      business_phone:     b.business_phone      ?? null,
      website_url:        b.website_url         ?? null,
      instagram_url:      b.instagram_url       ?? null,
      facebook_url:       b.facebook_url        ?? null,
      break_time_minutes: b.break_time_minutes,
      verification_note:  b.verification_note   ?? null,
      wallet: b.wallet
        ? {
            balance_inr:           b.wallet.balance / 100,
            lifetime_earnings_inr: b.wallet.lifetime_earnings / 100,
          }
        : null,
      auth_user: b.auth_user
        ? {
            id:               b.auth_user.id,
            email:            b.auth_user.email,
            is_active:        b.auth_user.is_active,
            is_suspended:     b.auth_user.is_suspended,
            suspended_at:     b.auth_user.suspended_at
              ? toIST(b.auth_user.suspended_at)
              : null,
            suspended_reason: b.auth_user.suspended_reason ?? null,
          }
        : null,
      owner: {
        id:      b.owner.id,
        name:    b.owner.name,
        phone:   b.owner.phone  ?? null,
        email:   b.owner.user.email,
        user_id: b.owner.user.id,
      },
      images: (b.images ?? []).map((img: any) => ({
        id:         img.id,
        image_url:  img.image_url,
        is_primary: img.is_primary,
      })),
      services: (b.services ?? []).map((sv: any) => ({
        id:              sv.id,
        name:            sv.platform_service.name,
        category:        sv.platform_service.category ?? null,
        offerings_count: sv._count?.offerings ?? undefined,
      })),
      schedules: (b.schedules ?? []).map((sc: any) => ({
        day_of_week:  sc.day_of_week,
        is_available: sc.is_available,
        open_time:    sc.open_time  ?? null,
        close_time:   sc.close_time ?? null,
      })),
      staff: (b.staff ?? []).map((s: any) => ({
        id:             s.id,
        name:           s.name,
        email:          s.email,
        average_rating: s.average_rating ?? 0,
        total_reviews:  s.total_reviews  ?? 0,
      })),
    };
  }

  static async suspendBusiness(businessId: string, reason: string) {
    const biz = await AdminBusinessesRepository.findBusinessWithAuthUser(businessId);
    if (!biz) throw new NotFoundError("Business not found.");
    if (!biz.auth_user_id || !biz.auth_user) {
      throw new BadRequestError("This business has no login account to suspend.");
    }
    if (biz.auth_user.is_suspended) {
      throw new BadRequestError("Business login is already suspended.");
    }

    await AdminBusinessesRepository.setAuthUserSuspension(biz.auth_user.id, true, reason);

    await AdminBusinessesRepository.createBusinessNotification(
      businessId,
      "BUSINESS_SUSPENDED",
      "Business Account Suspended",
      `Your business account has been suspended. Reason: ${reason}`,
      "BOTH",
    );

    emitToUser(biz.auth_user.id, "account:suspended", { reason });

    queueEmail({
      to:   biz.owner.user.email,
      type: "business-suspended",
      data: { businessName: biz.business_name, reason },
    }).catch(err => logger.warn("[AdminBiz] Suspend email failed:", err));

    return { message: "Business suspended." };
  }

  static async unsuspendBusiness(businessId: string) {
    const biz = await AdminBusinessesRepository.findBusinessWithAuthUser(businessId);
    if (!biz) throw new NotFoundError("Business not found.");
    if (!biz.auth_user_id || !biz.auth_user) {
      throw new BadRequestError("This business has no login account.");
    }
    if (!biz.auth_user.is_suspended) {
      throw new BadRequestError("Business login is not currently suspended.");
    }

    await AdminBusinessesRepository.setAuthUserSuspension(biz.auth_user.id, false);

    await AdminBusinessesRepository.createBusinessNotification(
      businessId,
      "BUSINESS_UNSUSPENDED",
      "Business Account Reinstated",
      "Your business account suspension has been lifted. You may log in again.",
      "BOTH",
    );

    emitToUser(biz.auth_user.id, "account:unsuspended", {});

    queueEmail({
      to:   biz.owner.user.email,
      type: "business-unsuspended",
      data: { businessName: biz.business_name },
    }).catch(err => logger.warn("[AdminBiz] Unsuspend email failed:", err));

    return { message: "Business unsuspended." };
  }
}