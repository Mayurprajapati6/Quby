import { prisma } from "../../../config/prisma";
import { redisClient } from "../../../config/redis";
import { BookingRepository } from "./booking.repository";
import { emitToUser } from "../../../socket/socket.service";
import { queueEmail } from "../../../services/email.services";
import { razorpay } from "../../../config/razorpay";
import { bookingQueue, escrowQueue, notificationQueue, analyticsQueue } from "../../../config/bullmq";
import { invalidateSlotCache } from "../../../utils/cache/slotCache";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import { add } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type {
  SuggestStaffDTO,
  StaffSuggestionResponseDTO,
  CheckAvailabilityDTO,
  CreateBookingDTO,
  CancelBookingDTO,
  CheckAvailabilityResponseDTO,
  CreateBookingResponseDTO,
  BookingListResponseDTO,
  BookingDetailDTO,
} from "./booking.types";

const IST = "Asia/Kolkata";
const PLATFORM_FEE_PERCENT = 10;
const NOTIF_TTL_DAYS = 30;

function toIST(date: Date): string {
  return formatInTimeZone(date, IST, "yyyy-MM-dd'T'HH:mm:ssxxx");
}
function toISTDate(date: Date): string {
  return formatInTimeZone(date, IST, "yyyy-MM-dd");
}

export class BookingService {

  static async suggestStaff(
    userId: string,
    dto:    SuggestStaffDTO,
  ): Promise<StaffSuggestionResponseDTO> {
    const { business_id, service_offering_ids, service_date } = dto;

    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer profile not found.");

    const business = await prisma.business.findUnique({
      where:  { id: business_id },
      select: { is_active: true, is_verified: true },
    });
    if (!business?.is_active || !business.is_verified) {
      throw new NotFoundError("Business not found or unavailable.");
    }

    const dateObj = new Date(service_date + "T00:00:00+05:30");
    const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: IST }));
    todayIST.setHours(0, 0, 0, 0);
    if (dateObj < todayIST) {
      throw new BadRequestError("Cannot check availability for a past date.");
    }

    const services = await prisma.businessServiceOffering.findMany({
      where:  { id: { in: service_offering_ids }, business_id, is_active: true },
      select: { id: true },
    });
    if (services.length !== service_offering_ids.length) {
      throw new BadRequestError("One or more services are invalid or not offered by this business.");
    }

    return BookingRepository.suggestStaff(business_id, service_offering_ids, dateObj);
  }

  static async checkAvailability(
    userId: string,
    dto:    CheckAvailabilityDTO,
  ): Promise<CheckAvailabilityResponseDTO> {
    const { business_id, service_offering_ids, service_date, staff_id, mode = "select" } = dto;

    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer profile not found.");

    const business = await prisma.business.findUnique({
      where:  { id: business_id },
      select: { is_active: true, is_verified: true },
    });
    if (!business?.is_active || !business.is_verified) {
      throw new NotFoundError("Business not found or unavailable.");
    }

    const dateObj  = new Date(service_date + "T00:00:00+05:30");
    const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: IST }));
    todayIST.setHours(0, 0, 0, 0);
    if (dateObj < todayIST) {
      throw new BadRequestError("Cannot book a date in the past.");
    }

    const offeringList = await prisma.businessServiceOffering.findMany({
      where:  { id: { in: service_offering_ids }, business_id, is_active: true },
      select: { id: true, price: true, discounted_price: true },
    });
    if (offeringList.length !== service_offering_ids.length) {
      throw new BadRequestError("One or more services are invalid or not offered by this business.");
    }

    const holiday = await prisma.holiday.findFirst({
      where: {
        business_id,
        start_date:           { lte: new Date(service_date + "T23:59:59+05:30") },
        end_date:             { gte: new Date(service_date + "T00:00:00+05:30") },
        applies_to_all_staff: true,
      },
    });
    if (holiday) {
      throw new BadRequestError("The business is closed on this date (holiday).");
    }

    const slots = await BookingRepository.findAvailableSlots({
      business_id,
      service_offering_ids,
      service_date: dateObj,
      preferred_staff_id: mode === "select" ? staff_id : undefined,
      mode,
    });

    if (slots.length === 0) {
      const suggestion = await BookingRepository.suggestStaff(
        business_id, service_offering_ids, dateObj,
      );
      if (suggestion.no_staff_reason) {
        const reasonMessages: Record<string, string> = {
          "holiday":           "The business is closed on this date.",
          "all_on_leave":      "All matching staff are on leave for this date. Please try another date.",
          "no_matching_staff": suggestion.message,
          "all_fully_booked":  "All matching staff are fully booked for this date. Please try another date.",
        };
        throw new BadRequestError(
          reasonMessages[suggestion.no_staff_reason] ?? "No available slots found."
        );
      }
      throw new BadRequestError("No available slots for the selected date and services.");
    }

    const reservation_token = await BookingRepository.createReservation({
      customer_id:          customer.id,
      business_id,
      service_offering_ids,
      service_date,
      slots,
    });

    const autoAssigned = mode === "random" && slots.length > 0
      ? {
          staff_id:   slots[0].staff_id,
          staff_name: slots[0].staff_name,
          reason:     `Earliest available: ${slots[0].staff_name} at ${toIST(slots[0].service_start_time)}`,
        }
      : undefined;

    return {
      reservation_token,
      expires_in:         600,
      service_date,
      is_holiday:         false,
      is_business_closed: false,
      mode,
      auto_assigned:      autoAssigned,
      slots: slots.map(s => ({
        staff_id:             s.staff_id,
        staff_name:           s.staff_name,
        avatar_url:           s.avatar_url,
        service_start_time:   toIST(s.service_start_time),
        arrival_window_start: toIST(s.arrival_window_start),
        arrival_window_end:   toIST(s.arrival_window_end),
        estimated_duration:   s.estimated_duration,
        queue_number:         s.queue_number,
      })),
    };
  }

  static async createBooking(
    userId: string,
    dto:    CreateBookingDTO,
  ): Promise<CreateBookingResponseDTO> {
    const { reservation_token, selected_slot_idx, idempotency_key, notes } = dto;

    const existing = await prisma.booking.findUnique({
      where:  { idempotency_key },
      select: { id: true, booking_number: true, status: true, service_amount: true, platform_fee: true, total_amount: true },
    });
    if (existing) {
      return {
        booking_id:     existing.id,
        booking_number: existing.booking_number,
        status:         existing.status,
        service_amount: existing.service_amount,
        platform_fee:   existing.platform_fee,
        total_amount:   existing.total_amount,
        expires_in:     600,
        is_idempotent:  true,
      };
    }

    const reservation = await BookingRepository.getReservation(reservation_token);
    if (!reservation) {
      throw new BadRequestError("Reservation expired or invalid. Please check availability again.");
    }

    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true, username: true, user: { select: { id: true, email: true } } },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    if (reservation.customer_id !== customer.id) {
      throw new ForbiddenError("This reservation does not belong to you.");
    }

    const slotIdx = Math.min(selected_slot_idx ?? 0, reservation.slots.length - 1);
    const slot    = reservation.slots[slotIdx];

    const serviceOfferings = await prisma.businessServiceOffering.findMany({
      where:  { id: { in: reservation.service_offering_ids } },
      select: { id: true, price: true, discounted_price: true },
    });
    const serviceAmount = serviceOfferings.reduce(
      (sum, s) => sum + (s.discounted_price ?? s.price), 0
    );
    const platformFee = Math.round(serviceAmount * PLATFORM_FEE_PERCENT / 100);
    const totalAmount = serviceAmount + platformFee;

    const platformServices = await prisma.businessServiceOffering.findMany({
      where:   { id: { in: reservation.service_offering_ids } },
      include: { platform_service: { select: { name: true } } },
    });
    const servicesSnapshot = platformServices.map(s => ({
      service_id:       s.id,
      name:             s.platform_service.name,
      price:            s.discounted_price ?? s.price,
      duration_minutes: 0,
    }));

    const bookingNumber = BookingRepository.generateBookingNumber();
    const serviceDate   = new Date(reservation.service_date + "T00:00:00+05:30");

    const dateLockKey  = `staff:${slot.staff_id}:${reservation.service_date}`;
    const slotLockKey  = `slot_lock:${slot.staff_id}:${reservation.service_date}:${slot.queue_number}`;

    const [dateLock, slotLock] = await Promise.all([
      redisClient.set(dateLockKey, "1", "EX", 5,  "NX"),
      redisClient.set(slotLockKey, "1", "EX", 30, "NX"),
    ]);
    if (!dateLock || !slotLock) {
      if (dateLock) await redisClient.del(dateLockKey).catch(() => {});
      if (slotLock) await redisClient.del(slotLockKey).catch(() => {});
      throw new BadRequestError("This slot was just taken. Please check availability again.");
    }

    try {
      const booking = await prisma.$transaction(async (tx) => {
        const newBooking = await tx.booking.create({
          data: {
            idempotency_key,
            booking_number:       bookingNumber,
            customer_id:          customer.id,
            business_id:          reservation.business_id,
            staff_id:             slot.staff_id,
            service_date:         serviceDate,
            queue_number:         slot.queue_number,
            arrival_window_start: slot.arrival_window_start,
            arrival_window_end:   slot.arrival_window_end,
            service_start_time:   slot.service_start_time,
            service_end_time:     slot.service_end_time,
            estimated_duration:   slot.estimated_duration,
            total_duration:       slot.total_duration,
            service_amount:       serviceAmount,
            platform_fee:         platformFee,
            total_amount:         totalAmount,
            services:             servicesSnapshot,
            status:               "PENDING_PAYMENT",
            notes:                notes ?? null,
            scan_absolute_start:    slot.arrival_window_end,
            scan_recommended_end:   new Date(slot.arrival_window_end.getTime() + 10 * 60000),
            scan_absolute_end:      new Date(slot.arrival_window_end.getTime() + 10 * 60000),
            service_start_expected: slot.arrival_window_end,
            service_end_expected:   slot.service_end_time,
          },
        });

        const newTx = await tx.transaction.create({
          data: {
            booking_id:  newBooking.id,
            customer_id: customer.id,
            business_id: reservation.business_id,
            staff_id:    slot.staff_id,
            amount:      totalAmount,
            currency:    "INR",
            status:      "PENDING",
          },
        });

        await tx.platformFeeTransaction.create({
          data: {
            transaction_id: newTx.id,
            booking_id:     newBooking.id,
            business_id:    reservation.business_id,
            staff_id:       slot.staff_id,
            customer_id:    customer.id,
            amount:         platformFee,
            status:         "PENDING",
          },
        });

        await tx.dailyQueue.upsert({
          where:  { staff_id_service_date: { staff_id: slot.staff_id, service_date: serviceDate } },
          create: { staff_id: slot.staff_id, service_date: serviceDate, last_queue_number: slot.queue_number },
          update: { last_queue_number: slot.queue_number },
        });

        return newBooking;
      });

      await BookingRepository.deleteReservation(reservation_token);

      await bookingQueue.add(
        `payment-timeout:${booking.id}`,
        { bookingId: booking.id, event: "payment-timeout" },
        { delay: 10 * 60 * 1000, jobId: `payment-timeout:${booking.id}`, attempts: 1 },
      );

      invalidateSlotCache(slot.staff_id, reservation.service_date).catch(() => {});

      const notifExpiresAt = add(new Date(), { days: NOTIF_TTL_DAYS });
      await prisma.customerNotification.create({
        data: {
          customer_id: customer.id,
          type:        "BOOKING_CONFIRMED",
          title:       "Booking Reserved",
          message:     `Your slot with ${slot.staff_name} is reserved. Complete payment within 10 minutes.`,
          expires_at:  notifExpiresAt,
        },
      }).catch(() => {});

      analyticsQueue.add(
        `booking-created:${booking.id}`,
        { type: "booking-created", bookingId: booking.id },
        { jobId: `analytics:booking-created:${booking.id}` },
      ).catch(() => {});

      return {
        booking_id:     booking.id,
        booking_number: booking.booking_number,
        status:         booking.status,
        service_amount: serviceAmount,
        platform_fee:   platformFee,
        total_amount:   totalAmount,
        expires_in:     600,
        is_idempotent:  false,
      };
    } finally {
      await Promise.all([
        redisClient.del(dateLockKey).catch(() => {}),
        redisClient.del(slotLockKey).catch(() => {}),
      ]);
    }
  }

  static async cancelBooking(bookingId: string, userId: string, dto: CancelBookingDTO) {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true, user: { select: { id: true, email: true } } },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    const booking = await BookingRepository.findBookingFull(bookingId);
    if (!booking) throw new NotFoundError("Booking not found.");
    if (booking.customer_id !== customer.id) throw new ForbiddenError("Access denied.");

    if (!["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status)) {
      throw new BadRequestError(`Cannot cancel a booking in '${booking.status}' state.`);
    }

    const now     = new Date();
    const wasPaid = booking.status === "CONFIRMED";

    const cancellableUntil = (booking as any).cancellable_until as Date | null;
    if (wasPaid && cancellableUntil && now > cancellableUntil) {
      throw new BadRequestError(
        `Cancellation window closed at ${toIST(cancellableUntil)}. ` +
        `If you do not attend, your payment is released to the business.`
      );
    }

    const refundAmount = wasPaid ? (booking as any).service_amount as number : 0;

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status:              "CANCELLED",
          cancelled_at:        now,
          cancelled_by:        "customer",
          cancellation_reason: dto.cancellation_reason ?? null,
        },
      });

      await tx.qRCode.updateMany({
        where: { booking_id: bookingId, qr_status: "ACTIVE" },
        data:  { expires_at: now, qr_status: "CANCELLED", is_used: true },
      });

      if (wasPaid) {
        await tx.transaction.updateMany({
          where: { booking_id: bookingId, status: "SUCCESS" },
          data:  { status: "REFUNDED", refund_status: "PENDING", refund_amount: refundAmount },
        });
        await tx.escrowTransaction.updateMany({
          where: { booking_id: bookingId, status: "HELD" },
          data:  { status: "REFUNDED", refunded_at: now },
        });
      }
    });

    await Promise.allSettled([
      bookingQueue.getJob(`payment-timeout:${bookingId}`).then(j => j?.remove()).catch(() => {}),
      bookingQueue.getJob(`no-show:${bookingId}`).then(j => j?.remove()).catch(() => {}),
      escrowQueue.getJob(`escrow:${bookingId}`).then(j => j?.remove()).catch(() => {}),
      notificationQueue.getJob(`reminder-1hr:${bookingId}`).then(j => j?.remove()).catch(() => {}),
      notificationQueue.getJob(`reminder-15min:${bookingId}`).then(j => j?.remove()).catch(() => {}),
    ]);

    notificationQueue.add(
      `booking-cancelled:${bookingId}`,
      { bookingId, type: "booking-cancelled" },
      { jobId: `booking-cancelled:${bookingId}` }
    ).catch(() => {});

    if (wasPaid) {
      const txn = (booking as any).transaction;
      const paymentId = txn?.razorpay_payment_id;
      if (paymentId && txn?.status === "SUCCESS") {
        try {
          await (razorpay.payments as any).refund(paymentId, { amount: refundAmount });
          await prisma.transaction.updateMany({
            where: { booking_id: bookingId },
            data:  { refund_status: "PROCESSING" },
          });
        } catch (err) {
          logger.error(`[Booking] Razorpay refund failed for ${bookingId}:`, err);
        }
      }
    }

    const notifExpiresAt = add(new Date(), { days: NOTIF_TTL_DAYS });
    await prisma.customerNotification.create({
      data: {
        customer_id: customer.id,
        type:        "BOOKING_CANCELLED",
        title:       "Booking Cancelled",
        message:     wasPaid
          ? "Your booking has been cancelled. Refund will be processed within 5-7 business days."
          : "Your booking has been cancelled.",
        expires_at:  notifExpiresAt,
      },
    });

    emitToUser(customer.user.id, "booking:cancelled", { bookingId });

    const staffUserId   = (booking as any).staff?.user?.id;
    const bizAuthUserId = (booking as any).business?.auth_user_id;
    const ownerUserId   = (booking as any).business?.owner?.user?.id;

    if (staffUserId) {
      emitToUser(staffUserId, "booking:cancelled", { bookingId, booking_number: booking.booking_number });
      await prisma.staffNotification.create({
        data: {
          staff_id:   booking.staff_id,
          type:       "BOOKING_CANCELLED",
          title:      "Booking Cancelled",
          message:    `${customer.name}'s booking #${booking.booking_number} has been cancelled.`,
          expires_at: notifExpiresAt,
        },
      }).catch(() => {});
    }

    if (bizAuthUserId) emitToUser(bizAuthUserId, "booking:cancelled", { bookingId, booking_number: booking.booking_number });
    if (ownerUserId)   emitToUser(ownerUserId,   "booking:cancelled", { bookingId, booking_number: booking.booking_number });

    await prisma.businessNotification.create({
      data: {
        business_id: booking.business_id,
        type:        "BOOKING_CANCELLED",
        title:       "Booking Cancelled",
        message:     `${customer.name}'s booking #${booking.booking_number} has been cancelled by customer.`,
        target:      "BOTH",
        expires_at:  notifExpiresAt,
      },
    }).catch(() => {});

    if (wasPaid) {
      queueEmail({
        to:   customer.user.email,
        type: "booking-cancelled",
        data: {
          customerName:  customer.name,
          businessName:  (booking as any).business?.business_name ?? "",
          serviceName:   Array.isArray((booking as any).services)
            ? (booking as any).services.map((s: any) => s.name ?? "").join(", ")
            : "",
          serviceDate:   booking.service_date.toISOString().slice(0, 10),
          bookingId,
          bookingNumber: booking.booking_number,
          reason:        dto.cancellation_reason ?? "No reason provided",
          refundAmount:  wasPaid ? ((booking as any).transaction?.refund_amount ?? (booking as any).service_amount ?? 0) : 0,
        },
      }).catch(err => logger.warn("[Booking] Cancel email failed:", err));

      queueEmail({
        to:   customer.user.email,
        type: "refund-confirmation",
        data: {
          customerName:  customer.name,
          businessName:  (booking as any).business?.business_name ?? "",
          bookingNumber: booking.booking_number,
          refundAmount:  refundAmount,
        },
      }).catch(err => logger.warn("[Booking] Refund email failed:", err));
    }

    invalidateSlotCache(
      booking.staff_id,
      booking.service_date.toISOString().slice(0, 10),
    ).catch(() => {});

    analyticsQueue.add(
      `booking-cancelled:${bookingId}`,
      { type: "booking-cancelled", bookingId },
      { jobId: `analytics:booking-cancelled:${bookingId}` },
    ).catch(() => {});

    return { booking_id: bookingId, status: "CANCELLED" };
  }

  static async getMyBookings(
    userId: string,
    opts: { tab: string; page: number; limit: number }
  ): Promise<BookingListResponseDTO> {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    const { bookings, total } = await BookingRepository.findByCustomerTab(
      customer.id, opts.tab, opts.page, opts.limit,
    );

    return {
      bookings: bookings.map(b => ({
        id:                 b.id,
        booking_number:     b.booking_number,
        business_name:      (b as any).business.business_name,
        business_logo:      (b as any).business.logo_url ?? null,
        staff_name:         (b as any).staff.name,
        staff_avatar:       (b as any).staff.avatar_url ?? null,
        service_date:       toISTDate(b.service_date),
        service_start_time: toIST(b.service_start_time),
        status:             b.status,
        service_amount:     b.service_amount,
        platform_fee:       b.platform_fee,
        total_amount:       b.total_amount,
        services: Array.isArray(b.services)
          ? (b.services as any[]).map((s: any) => s.name ?? "")
          : [],
        refund_status:     (b as any).transaction?.refund_status ?? null,
        refund_amount:     (b as any).transaction?.refund_amount ?? null,
        cancellable_until: (b as any).cancellable_until ? toIST(new Date((b as any).cancellable_until)) : null,
        is_cancellable:    (b as any).cancellable_until
          ? new Date() < new Date((b as any).cancellable_until)
          : b.status === "PENDING_PAYMENT",
      })),
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getBookingDetail(bookingId: string, userId: string): Promise<BookingDetailDTO> {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    const booking = await BookingRepository.findBookingFull(bookingId);
    if (!booking) throw new NotFoundError("Booking not found.");
    if (booking.customer_id !== customer.id) throw new ForbiddenError("Access denied.");

    const b = booking as any;
    return {
      id:                   booking.id,
      booking_number:       booking.booking_number,
      status:               booking.status,
      notes:                booking.notes ?? null,
      cancellation_reason:  booking.cancellation_reason ?? null,
      cancelled_at:         booking.cancelled_at ? toIST(booking.cancelled_at) : null,
      service_amount:       booking.service_amount,
      platform_fee:         booking.platform_fee,
      total_amount:         booking.total_amount,
      cancellable_until:    (booking as any).cancellable_until ? toIST(new Date((booking as any).cancellable_until)) : null,
      is_cancellable:       (booking as any).cancellable_until ? new Date() < new Date((booking as any).cancellable_until) : booking.status === "PENDING_PAYMENT",
      service_date:         toISTDate(booking.service_date),
      service_start_time:   toIST(booking.service_start_time),
      arrival_window_start: toIST(booking.arrival_window_start),
      arrival_window_end:   toIST(booking.arrival_window_end),
      service_end_time:     toIST(booking.service_end_time),
      estimated_duration:   booking.estimated_duration,
      total_duration:       booking.total_duration,
      queue_number:         booking.queue_number,
      qr_image_url:         b.qr_code?.qr_image_url  ?? null,
      qr_expires_at:        b.qr_code?.expires_at ? toIST(b.qr_code.expires_at) : null,
      business: {
        id:             b.business.id,
        business_name:  b.business.business_name,
        address_line1:  b.business.address_line1,
        city:           b.business.city,
        state:          b.business.state,
        map_link:       b.business.map_link        ?? null,
        business_phone: b.business.business_phone  ?? null,
        logo_url:       b.business.logo_url        ?? null,
      },
      staff: {
        id:         b.staff.id,
        name:       b.staff.name,
        avatar_url: b.staff.avatar_url ?? null,
        phone:      b.staff.phone      ?? null,
      },
      services: Array.isArray(booking.services)
        ? (booking.services as any[]).map((s: any) => ({
            service_id:       s.service_id ?? "",
            name:             s.name ?? "",
            price:            s.price ?? 0,
            duration_minutes: s.duration_minutes ?? 0,
          }))
        : [],
      transaction: b.transaction ? {
        id:                  b.transaction.id,
        status:              b.transaction.status,
        razorpay_payment_id: b.transaction.razorpay_payment_id ?? null,
        paid_at:             b.transaction.paid_at ? toIST(b.transaction.paid_at) : null,
        refund_status:       b.transaction.refund_status  ?? null,
        refund_amount:       b.transaction.refund_amount  ?? null,
      } : null,
    };
  }
}