import { AdminUsersRepository } from "./admin-users.repository";
import { queueEmail } from "../../../services/email.services";
import { emitToUser } from "../../../socket/socket.service";
import { NotFoundError, BadRequestError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import logger from "../../../config/logger.config";

const IST = "Asia/Kolkata";
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

function suspensionInfo(user: any) {
  return {
    is_suspended:     user.is_suspended,
    suspended_at:     user.suspended_at     ? toIST(user.suspended_at)    : null,
    suspended_reason: user.suspended_reason ?? null,
  };
}

export class AdminUsersService {

  static async getOwners(opts: {
    search?:       string;
    is_suspended?: boolean;   
    page:          number;
    limit:         number;
  }) {
    const { owners, total } = await AdminUsersRepository.findOwners({
      search:       opts.search,
      is_suspended: opts.is_suspended,
      skip:         (opts.page - 1) * opts.limit,
      take:         opts.limit,
    });

    return {
      owners: owners.map(o => ({
        id:                    o.id,
        name:                  o.name,
        email:                 o.user.email,
        phone:                 o.phone        ?? null,
        avatar_url:            o.avatar_url   ?? null,
        city:                  o.city,
        state:                 o.state,
        total_businesses:      o.total_businesses,
        active_businesses:     o.active_businesses,
        lifetime_earnings_inr: o.lifetime_earnings / 100,
        business_count:        (o as any)._count.businesses,
        is_active:             o.user.is_active,
        ...suspensionInfo(o.user),
        joined_at: toISTDate(o.created_at),
      })),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async getOwnerDetail(ownerId: string) {
    const o = await AdminUsersRepository.findOwnerById(ownerId);
    if (!o) throw new NotFoundError("Owner not found.");

    return {
      id:                    o.id,
      name:                  o.name,
      email:                 o.user.email,
      phone:                 o.phone         ?? null,
      avatar_url:            o.avatar_url    ?? null,
      city:                  o.city,
      state:                 o.state,
      address_line1:         o.address_line1  ?? null,
      address_line2:         o.address_line2  ?? null,
      personal_info:         o.personal_info  ?? null,
      total_businesses:      o.total_businesses,
      active_businesses:     o.active_businesses,
      lifetime_earnings_inr: o.lifetime_earnings / 100,
      total_bookings:        o.total_bookings,
      is_active:             o.user.is_active,
      ...suspensionInfo(o.user),
      joined_at: toISTDate(o.created_at),
      businesses: (o.businesses ?? []).map((b: any) => ({
        id:             b.id,
        business_name:  b.business_name,
        city:           b.city,
        state:          b.state,
        is_active:      b.is_active,
        is_verified:    b.is_verified,
        average_rating: b.average_rating ?? 0,
      })),
    };
  }

  static async getCustomers(opts: {
    search?:       string;
    city?:         string;
    state?:        string;
    is_suspended?: boolean;
    page:          number;
    limit:         number;
  }) {
    const { customers, total } = await AdminUsersRepository.findCustomers({
      search:       opts.search,
      city:         opts.city,
      state:        opts.state,
      is_suspended: opts.is_suspended,
      skip:         (opts.page - 1) * opts.limit,
      take:         opts.limit,
    });

    return {
      customers: customers.map(c => ({
        id:                 c.id,
        username:           c.username,
        name:               c.name,
        email:              c.user.email,
        phone:              c.phone      ?? null,
        avatar_url:         c.avatar_url ?? null,
        city:               c.city,
        state:              c.state,
        total_bookings:     c.total_bookings,
        completed_bookings: c.completed_bookings,
        total_spent_inr:    c.total_spent / 100,
        booking_count:      (c as any)._count.bookings,
        review_count:       (c as any)._count.reviews,
        is_active:          c.user.is_active,
        ...suspensionInfo(c.user),
        joined_at: toISTDate(c.created_at),
      })),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async getCustomerDetail(customerId: string) {
    const c = await AdminUsersRepository.findCustomerById(customerId);
    if (!c) throw new NotFoundError("Customer not found.");

    return {
      id:                   c.id,
      username:             c.username,
      name:                 c.name,
      email:                c.user.email,
      phone:                c.phone        ?? null,
      avatar_url:           c.avatar_url   ?? null,
      city:                 c.city,
      state:                c.state,
      address_line1:        c.address_line1 ?? null,
      total_bookings:       c.total_bookings,
      completed_bookings:   c.completed_bookings,
      cancelled_bookings:   c.cancelled_bookings,
      total_spent_inr:      c.total_spent / 100,
      wallet_balance_inr:   (c.wallet?.balance ?? 0) / 100,
      lifetime_spent_inr:   (c.wallet?.lifetime_spent ?? 0) / 100,
      lifetime_refunds_inr: (c.wallet?.lifetime_refunds ?? 0) / 100,
      current_streak:       c.current_streak,
      longest_streak:       c.longest_streak,
      favourite_count:      (c as any)._count.favourites,
      review_count:         (c as any)._count.reviews,
      is_active:            c.user.is_active,
      ...suspensionInfo(c.user),
      joined_at:      toISTDate(c.created_at),
      first_login_at: c.first_login_at ? toIST(c.first_login_at) : null,
    };
  }

  static async getStaff(opts: {
    search?:      string;
    business_id?: string;
    page:         number;
    limit:        number;
  }) {
    const { staff, total } = await AdminUsersRepository.findStaff({
      search:      opts.search,
      business_id: opts.business_id,
      skip:        (opts.page - 1) * opts.limit,
      take:        opts.limit,
    });

    return {
      staff: staff.map(s => ({
        id:               s.id,
        name:             s.name,
        email:            s.email,
        phone:            s.phone       ?? null,
        avatar_url:       s.avatar_url  ?? null,
        specialization:   s.specialization ?? null,
        average_rating:   s.average_rating ?? 0,
        total_reviews:    s.total_reviews  ?? 0,
        is_active:        s.is_active,
        is_verified:      s.is_verified,
        business: {
          id:            (s as any).business.id,
          business_name: (s as any).business.business_name,
          city:          (s as any).business.city,
        },
        booking_count:    (s as any)._count.bookings,
        review_count:     (s as any)._count.reviews,
        user_suspended:   (s as any).user.is_suspended,
        suspended_reason: (s as any).user.suspended_reason ?? null,
        joined_at: toISTDate(s.created_at),
      })),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }

  static async getStaffDetail(staffId: string) {
    const s = await AdminUsersRepository.findStaffById(staffId);
    if (!s) throw new NotFoundError("Staff member not found.");

    return {
      id:               s.id,
      name:             s.name,
      email:            s.email,
      phone:            s.phone         ?? null,
      avatar_url:       s.avatar_url    ?? null,
      bio:              s.bio           ?? null,
      specialization:   s.specialization ?? null,
      experience_years: s.experience_years ?? null,
      city:             s.city           ?? null,
      state:            s.state          ?? null,
      average_rating:   s.average_rating  ?? 0,
      total_reviews:    s.total_reviews   ?? 0,
      is_active:        s.is_active,
      is_verified:      s.is_verified,
      current_streak:   s.current_service_streak ?? 0,
      longest_streak:   s.longest_service_streak ?? 0,
      business: {
        id:            (s as any).business.id,
        business_name: (s as any).business.business_name,
        city:          (s as any).business.city,
        state:         (s as any).business.state,
      },
      services: (s.services ?? []).map((sv: any) => ({
        name:             sv.service_offering.platform_service.name,
        category:         sv.service_offering.platform_service.category ?? null,
        duration_minutes: sv.duration_minutes,
        is_available:     sv.is_available,
      })),
      booking_count: (s as any)._count.bookings,
      review_count:  (s as any)._count.reviews,
      leave_count:   (s as any)._count.leaves,
      ...suspensionInfo((s as any).user),
      joined_at: toISTDate(s.created_at),
    };
  }

  static async suspendUser(userId: string, reason: string) {
    const user = await AdminUsersRepository.findUserById(userId);
    if (!user) throw new NotFoundError("User not found.");
    if (user.is_suspended) throw new BadRequestError("User is already suspended.");

    await AdminUsersRepository.setUserSuspension(userId, true, reason);

    emitToUser(userId, "account:suspended", { reason });

    queueEmail({
      to:   user.email,
      type: "account-suspended",
      data: { reason },
    }).catch(err => logger.warn("[AdminUsers] Suspend email failed:", err));

    return { message: "User suspended." };
  }

  static async unsuspendUser(userId: string) {
    const user = await AdminUsersRepository.findUserById(userId);
    if (!user) throw new NotFoundError("User not found.");
    if (!user.is_suspended) throw new BadRequestError("User is not currently suspended.");

    await AdminUsersRepository.setUserSuspension(userId, false);

    emitToUser(userId, "account:unsuspended", {});

    queueEmail({
      to:   user.email,
      type: "account-unsuspended",
      data: {},
    }).catch(err => logger.warn("[AdminUsers] Unsuspend email failed:", err));

    return { message: "User unsuspended." };
  }
}