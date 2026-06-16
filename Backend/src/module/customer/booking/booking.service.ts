import { prisma }                   from "../../../config/prisma";
import { redisClient }              from "../../../config/redis";
import { Prisma } from "../../../../generated/prisma/client.js";
import {
  BookingRepository,
  deriveArrivalEnd,
  deriveArrivalStart,
  deriveScanWindowEnd,
  deriveServiceEnd,
}                                   from "./booking.repository";
import { emitToUser }               from "../../../socket/socket.service";
import { queueEmail }               from "../../../services/email.services";
import {
  bookingQueue,
  notificationQueue,
  analyticsQueue,
}                                   from "../../../config/bullmq";
import { invalidateSlotCache }      from "../../../utils/cache/slotCache";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
}                                   from "../../../utils/errors/app.error";
import logger                       from "../../../config/logger.config";
import { addMinutes }               from "date-fns";
import { formatInTimeZone }         from "date-fns-tz";
import type {
  CheckAvailabilityDTO,
  CreateBookingDTO,
  CancelBookingDTO,
  CheckAvailabilityResponseDTO,
  CreateBookingResponseDTO,
  BookingListResponseDTO,
  BookingDetailDTO,
} from "./booking.types";

const TZ = "Asia/Kolkata";

type AvailabilityErrorReason =
  | "on_leave" | "not_scheduled" | "queue_overflow"
  | "all_on_leave" | "all_fully_booked" | "holiday"
  | "no_slots"    | "past_date";

function toTZ(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx");
}
function toTZDate(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

export class BookingService {

  // ── suggestStaff ────────────────────────────────────────────────────────────
  static async suggestStaff(
    business_id: string,
    serviceIds:  string[],
    date:        Date,
  ) {
    return BookingRepository.suggestStaff(business_id, serviceIds, date);
  }

  // ── checkAvailability ───────────────────────────────────────────────────────
  static async checkAvailability(
    userId: string,
    dto:    CheckAvailabilityDTO,
  ): Promise<CheckAvailabilityResponseDTO> {
    const { business_id, service_offering_ids, service_date, staff_id, mode = "select" } = dto;

    // ── Customer guard ────────────────────────────────────────────────────────
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer profile not found.");

    const business = await prisma.business.findUnique({
      where:  { id: business_id },
      select: { is_active: true },
    });
    if (!business?.is_active) throw new NotFoundError("Business not found or unavailable.");

    // ── Past-date guard ───────────────────────────────────────────────────────
    // Use date-fns-tz to get current date in IST timezone (works on any server timezone)
    const todayIST = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
    const dateObj = new Date(service_date + "T00:00:00+05:30");
    const todayTZ = new Date(todayIST + "T00:00:00+05:30");
    if (dateObj < todayTZ) {
      throw new BadRequestError("Cannot book a date in the past.", {
        reason: "past_date" satisfies AvailabilityErrorReason,
      });
    }

    // ── Service validity ──────────────────────────────────────────────────────
    const offeringList = await prisma.businessServiceOffering.findMany({
      where:  { id: { in: service_offering_ids }, business_id, is_active: true },
      select: { id: true, price: true, discounted_price: true },
    });
    if (offeringList.length !== service_offering_ids.length) {
      throw new BadRequestError(
        "One or more services are invalid or not offered by this business.",
      );
    }

    // ── Holiday guard ─────────────────────────────────────────────────────────
    const holiday = await prisma.holiday.findFirst({
      where: {
        business_id,
        start_date:           { lte: new Date(service_date + "T23:59:59+05:30") },
        end_date:             { gte: new Date(service_date + "T00:00:00+05:30") },
        applies_to_all_staff: true,
      },
    });
    if (holiday) {
      throw new BadRequestError("The business is closed on this date (holiday).", {
        reason: "holiday" satisfies AvailabilityErrorReason,
      });
    }

    // ── Find slots (gap-fill, read-only) ─────────────────────────────────────
    const slots = await BookingRepository.findAvailableSlots({
      business_id,
      service_offering_ids,
      service_date: dateObj,
      preferred_staff_id: mode === "select" ? staff_id : undefined,
      mode,
    });

    if (slots.length === 0) {
      if (mode === "select" && staff_id) {
        const { reason, message } = await BookingService._diagnoseSelectStaff({
          business_id, staff_id, service_offering_ids, service_date: dateObj,
        });
        throw new BadRequestError(message, { reason });
      }
      const { reason, message } = await BookingService._diagnoseRandomNoSlots({
        business_id, service_offering_ids, service_date: dateObj,
      });
      throw new BadRequestError(message, { reason });
    }

    // ── Create reservation token ──────────────────────────────────────────────
    const reservation_token = await BookingRepository.createReservation({
      customer_id:          customer.id,
      business_id,
      service_offering_ids,
      service_date,
      slots,
    });

    const autoAssigned =
      mode === "random" && slots.length > 0
        ? {
            staff_id:   slots[0].staff_id,
            staff_name: slots[0].staff_name,
            reason:     `Earliest available: ${slots[0].staff_name} at ${toTZ(slots[0].service_start_time)}`,
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
        service_start_time:   toTZ(s.service_start_time),
        arrival_window_start: toTZ(deriveArrivalStart(s.service_start_time)),
        arrival_window_end:   toTZ(deriveArrivalEnd(s.service_start_time)),
        scan_window_end:      toTZ(deriveScanWindowEnd(s.service_start_time)),
        estimated_duration:   s.estimated_duration,
        queue_number:         s.queue_number,
      })),
    };
  }

  static async voidPendingBooking(
    bookingId: string,
    userId:    string,
  ): Promise<{ booking_id: string; status: string }> {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");
 
    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: {
        id:           true,
        customer_id:  true,
        staff_id:     true,
        service_date: true,
        status:       true,
        created_at:   true,
      },
    });
 
    if (!booking)                             throw new NotFoundError("Booking not found.");
    if (booking.customer_id !== customer.id)  throw new ForbiddenError("Access denied.");
    if (booking.status !== "PENDING_PAYMENT") {
      // Idempotent — already voided/cancelled is fine
      if (["EXPIRED", "CANCELLED"].includes(booking.status)) {
        return { booking_id: bookingId, status: booking.status };
      }
      throw new BadRequestError(
        `Cannot void a booking with status '${booking.status}'. ` +
        "Only PENDING_PAYMENT bookings can be voided via navigation.",
      );
    }
 
    // Mark EXPIRED (not CANCELLED — no refund, no notifications needed)
    await prisma.booking.update({
      where: { id: bookingId },
      data:  { status: "EXPIRED", cancelled_at: new Date(), is_visible: false },
    });
 
    const safeId  = String(bookingId).replace(/:/g, "-");
    const dateStr = booking.service_date.toISOString().slice(0, 10);
 
    // Cancel BullMQ payment-timeout job
    await bookingQueue
      .getJob(`payment-timeout-${safeId}`)
      .then(j => j?.remove())
      .catch(() => {});
 
    await redisClient.del(`slot_lock:${booking.staff_id}:${dateStr}`).catch(() => {});
 
    // Invalidate slot cache
    invalidateSlotCache(booking.staff_id, dateStr).catch(() => {});
 
    logger.info(`[BookingService] voidPendingBooking: ${bookingId} → EXPIRED (user navigation)`);
 
    return { booking_id: bookingId, status: "EXPIRED" };
  }

  
  static async createBooking(
    userId: string,
    dto:    CreateBookingDTO,
  ): Promise<CreateBookingResponseDTO> {
    const { reservation_token, selected_slot_idx, idempotency_key, notes } = dto;
 
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: {
        id:   true, name: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!customer) throw new NotFoundError("Customer not found.");
 
    // ── Idempotency ───────────────────────────────────────────────────────────
    const existingByKey = await prisma.booking.findUnique({
      where:  { idempotency_key },
      select: { id: true, booking_number: true, status: true, service_amount: true },
    });
    if (existingByKey) {
      return {
        booking_id:     existingByKey.id,
        booking_number: existingByKey.booking_number,
        status:         existingByKey.status,
        service_amount: existingByKey.service_amount,
        expires_in:     600,
        is_idempotent:  true,
      };
    }
 
    // ── Per-customer Redis lock ───────────────────────────────────────────────
    const customerLockKey = `create_booking:${customer.id}`;
    const gotCustomerLock = await redisClient.set(customerLockKey, "1", "EX", 15, "NX");
    if (!gotCustomerLock) {
      throw new BadRequestError(
        "A booking is already being created for your account. Please wait a moment and try again.",
      );
    }
 
    // ── PENDING_PAYMENT guard ─────────────────────────────────────────────────
    const existingPending = await prisma.booking.findFirst({
      where: { customer_id: customer.id, status: "PENDING_PAYMENT" },
    });
    if (existingPending) {
      const ageMs     = Date.now() - new Date(existingPending.created_at).getTime();
      const isStale   = ageMs > 10 * 60 * 1000;
      const sameToken = (existingPending as any).reservation_token === reservation_token;
 
      if (isStale) {
        // Case A: expired — silently expire and continue
        await prisma.booking.update({
          where: { id: existingPending.id },
          data:  { status: "EXPIRED", cancelled_at: new Date(), is_visible: false },
        });
        const staleDateStr = (existingPending as any).service_date?.toISOString().slice(0, 10) ?? "";
        invalidateSlotCache((existingPending as any).staff_id, staleDateStr).catch(() => {});
        await redisClient.del(`slot_lock:${(existingPending as any).staff_id}:${staleDateStr}`).catch(() => {});
      } else if (sameToken) {
        // Case B: same reservation — idempotent return (network retry)
        await redisClient.del(customerLockKey).catch(() => {});
        return {
          booking_id:     existingPending.id,
          booking_number: existingPending.booking_number,
          status:         existingPending.status,
          service_amount: existingPending.service_amount,
          expires_in:     600,
          is_idempotent:  true,
        };
      } else {
        // Case C: different reservation — user navigated back and re-selected.
        // voidPendingBooking SHOULD have been called by the frontend, but as a
        // safety net we expire it here and clean up the slot_lock.
        logger.info(
          `[createBooking] Expiring stale PENDING_PAYMENT ${existingPending.id} ` +
          `(reservation mismatch) for fresh booking with token ${reservation_token}`,
        );
        await prisma.booking.update({
          where: { id: existingPending.id },
          data:  { status: "EXPIRED", cancelled_at: new Date(), is_visible: false },
        });
        const staleDateStr = (existingPending as any).service_date?.toISOString().slice(0, 10) ?? "";
        const staleId      = String(existingPending.id).replace(/:/g, "-");
        await bookingQueue.getJob(`payment-timeout-${staleId}`).then(j => j?.remove()).catch(() => {});
        invalidateSlotCache((existingPending as any).staff_id, staleDateStr).catch(() => {});
        await redisClient.del(`slot_lock:${(existingPending as any).staff_id}:${staleDateStr}`).catch(() => {});
      }
    }
 
    // ── Validate reservation ──────────────────────────────────────────────────
    const reservation = await BookingRepository.getReservation(reservation_token);
    if (!reservation) {
      throw new BadRequestError(
        "Reservation expired or invalid. Please check availability again.",
      );
    }
    if (reservation.customer_id !== customer.id) {
      throw new ForbiddenError("This reservation does not belong to you.");
    }
 
    const slotIdx  = Math.min(selected_slot_idx ?? 0, reservation.slots.length - 1);
    const slot     = reservation.slots[slotIdx];
    const dateStr  = reservation.service_date;
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const todayStr = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
    const isToday  = dateStr === todayStr;
 
    // ── Pricing ───────────────────────────────────────────────────────────────
    const serviceOfferings = await prisma.businessServiceOffering.findMany({
      where:  { id: { in: reservation.service_offering_ids } },
      select: { id: true, price: true, discounted_price: true },
    });
    const serviceAmount = serviceOfferings.reduce(
      (sum, s) => sum + (s.discounted_price ?? s.price), 0,
    );
 
    // ── Service snapshot ──────────────────────────────────────────────────────
    const platformServices = await prisma.businessServiceOffering.findMany({
      where:   { id: { in: reservation.service_offering_ids } },
      include: {
        platform_service: { select: { name: true, image_url: true } },
        staff_services:   {
          where:  { staff_id: slot.staff_id },
          select: { duration_minutes: true },
        },
      },
    });
    const servicesSnapshot = platformServices.map(s => ({
      service_id:       s.id,
      name:             s.platform_service.name,
      price:            s.discounted_price ?? s.price,
      duration_minutes: s.staff_services[0]?.duration_minutes ?? 0,
      image_url:        s.platform_service.image_url ?? null,
    }));
 
    const bookingNumber = BookingRepository.generateBookingNumber();
 
    // ── Layer 1: Redis NX slot lock ───────────────────────────────────────────
    const slotLockKey = `slot_lock:${slot.staff_id}:${dateStr}`;
    const gotLock     = await redisClient.set(slotLockKey, customer.id, "EX", 120, "NX");
    if (!gotLock) {
      throw new BadRequestError(
        "A booking for this stylist is being processed. Please wait a moment and try again.",
      );
    }
 
    // ── Layer 2 + 3: SERIALIZABLE TX with FOR UPDATE ──────────────────────────
    let booking: any;
    try {
      booking = await prisma.$transaction(async (tx) => {
 
        await tx.dailyQueue.upsert({
          where:  { staff_id_service_date: { staff_id: slot.staff_id, service_date: dayStart } },
          create: { staff_id: slot.staff_id, service_date: dayStart, last_queue_number: 0 },
          update: {},
        });
 
        await tx.$executeRaw`
          SELECT id FROM "daily_queues"
          WHERE staff_id = ${slot.staff_id}
            AND service_date = ${dayStart}
          FOR UPDATE
        `;
 
        const dow = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][
          new Date(dayStart).getDay()
        ] as any;
 
        const [staffSchedule, bizSchedule] = await Promise.all([
          tx.staffSchedule.findFirst({
            where:  { staff_id: slot.staff_id, day_of_week: dow, is_available: true },
            select: { start_time: true, end_time: true },
          }),
          tx.businessSchedule.findFirst({
            where:  { business_id: reservation.business_id, day_of_week: dow, is_open: true },
            select: { open_time: true, close_time: true },
          }),
        ]);
 
        const rawOpen  = staffSchedule?.start_time  ?? bizSchedule?.open_time  ?? "09:00";
        const rawClose = staffSchedule?.end_time    ?? bizSchedule?.close_time ?? "18:00";
        const openTime  = new Date(`${dateStr}T${rawOpen}:00+05:30`);
        const closeTime = new Date(`${dateStr}T${rawClose}:00+05:30`);
 
        const actualStart = await BookingRepository.computeActualSlotInTransaction(
          tx, slot.staff_id, dayStart, dateStr,
          openTime, closeTime, slot.estimated_duration, isToday,
        );
 
        if (!actualStart) {
          // Gap-fill couldn't find ANY slot (staff fully booked or all gaps too small)
          // This is NOT a concurrent booking conflict — it's a legitimate "no availability" scenario
          const error = new BadRequestError(
            "No slot is available for this stylist on this date. Please refresh and try again.",
          );
          (error as any).code = "NO_SLOTS_AVAILABLE";
          throw error;
        }
 
        const actualEnd = addMinutes(actualStart, slot.estimated_duration);
        if (actualEnd > closeTime) {
          throw new BadRequestError(
            "The computed slot exceeds working hours. Please choose a different date or stylist.",
          );
        }
 
        const queue = await tx.dailyQueue.update({
          where: { staff_id_service_date: { staff_id: slot.staff_id, service_date: dayStart } },
          data:  { last_queue_number: { increment: 1 } },
          select: { last_queue_number: true },
        });
 
        let newBooking: any;
        try {
          newBooking = await tx.booking.create({
            data: {
              idempotency_key,
              booking_number:     bookingNumber,
              customer_id:        customer.id,
              business_id:        reservation.business_id,
              staff_id:           slot.staff_id,
              service_date:       dayStart,
              service_start_time: actualStart,
              estimated_duration: slot.estimated_duration,
              total_duration:     slot.total_duration,
              queue_number:       queue.last_queue_number,
              service_amount:     serviceAmount,
              services:           servicesSnapshot,
              status:             "PENDING_PAYMENT",
              notes:              notes ?? null,
              reservation_token,
            },
          });
        } catch (e: any) {
          // P2002 = unique constraint violation on (staff_id, service_date, service_start_time)
          // This means another booking was created for this exact slot between our read and write
          if (e.code === "P2002") {
            const error = new BadRequestError("Slot already booked. Please refresh and try again.");
            (error as any).code = "SLOT_CONFLICT";
            throw error;
          }
          throw e;
        }
 
        await tx.payment.create({
          data: {
            booking_id:  newBooking.id,
            customer_id: customer.id,
            business_id: reservation.business_id,
            staff_id:    slot.staff_id,
            amount:      serviceAmount,
            currency:    "INR",
            status:      "PENDING",
          },
        });
 
        return newBooking;
 
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout:        10_000,
      });
 
    } catch (err: any) {
      await redisClient.del(slotLockKey).catch(() => {});
      await redisClient.del(customerLockKey).catch(() => {});
      
      // P2002 at transaction level = concurrent booking conflict
      if (err?.code === "P2002") {
        const error = new BadRequestError("Slot was just taken. Please try again.");
        (error as any).code = "SLOT_CONFLICT";
        throw error;
      }
      
      // Preserve error code from inner transaction
      if (err?.code === "NO_SLOTS_AVAILABLE" || err?.code === "SLOT_CONFLICT") {
        throw err;
      }
      
      throw err;
    }
 
    await BookingRepository.deleteReservation(reservation_token).catch(() => {});
 
    const safeId = String(booking.id).replace(/:/g, "-");
 
    await bookingQueue.add(
      `payment-timeout-${safeId}`,
      { bookingId: booking.id, event: "payment-timeout" },
      { delay: 10 * 60 * 1000, jobId: `payment-timeout-${safeId}`, attempts: 1 },
    ).catch(err => logger.error("Failed to schedule payment-timeout job", err));
 
    invalidateSlotCache(slot.staff_id, dateStr).catch(() => {});
 
    analyticsQueue.add(
      `booking-created-${safeId}`,
      { type: "booking-created", bookingId: booking.id },
      { jobId: `analytics-booking-created-${safeId}` },
    ).catch(() => {});
 
    return {
      booking_id:     booking.id,
      booking_number: booking.booking_number,
      status:         booking.status,
      service_amount: serviceAmount,
      expires_in:     600,
      is_idempotent:  false,
    };
  }

   // ── cancelBooking ────────────────────────────────────────────────────────────
  /**
   * Cancels a confirmed (paid or unpaid) booking.
   * Frees the slot immediately via slot_lock deletion + slot cache invalidation.
   */
  static async cancelBooking(
    bookingId: string,
    userId:    string,
    dto:       CancelBookingDTO,
  ) {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true, user: { select: { id: true, email: true } } },
    });
    if (!customer) throw new NotFoundError("Customer not found.");
 
    const booking = await BookingRepository.findBookingFull(bookingId);
    if (!booking) throw new NotFoundError("Booking not found.");
 
    if (booking.status === "PENDING_PAYMENT") {
      throw new BadRequestError("Cannot cancel an unpaid booking.");
    }
    if (booking.customer_id !== customer.id) throw new ForbiddenError("Access denied.");
    if (booking.status !== "CONFIRMED") {
      throw new BadRequestError(`Cannot cancel a booking in '${booking.status}' state.`);
    }
 
    const now              = new Date();
    const wasPaid          = (booking as any).payment?.status === "PAID";
    const cancellableUntil = (booking as any).cancellable_until as Date | null;
 
    if (wasPaid && cancellableUntil && now > cancellableUntil) {
      throw new BadRequestError(
        `Cancellation window closed at ${toTZ(cancellableUntil)}. ` +
        `If you do not attend, payment is retained by the business.`,
      );
    }
 
    const targetStatus = wasPaid ? "REFUND_INITIATED" : "CANCELLED";
 
    const updateResult = await prisma.booking.updateMany({
      where: {
        id:      bookingId,
        status:  booking.status as any,
        version: (booking as any).version,
      },
      data: {
        status:              targetStatus,
        version:             { increment: 1 },
        cancelled_at:        now,
        cancelled_by:        dto.cancellation_reason === "USER_NAVIGATION" ? "SYSTEM" : "CUSTOMER",
        cancellation_reason: dto.cancellation_reason ?? null,
      },
    });
 
    if (updateResult.count === 0) {
      throw new BadRequestError("Booking was already modified. Please refresh and try again.");
    }
 
    if ((dto as any)?.silent) {
      return { booking_id: bookingId, status: targetStatus };
    }
 
    await prisma.customer.update({
      where: { id: customer.id },
      data:  { cancelled_bookings: { increment: 1 } },
    }).catch(() => {});
 
    await prisma.qRCode.updateMany({
      where: { booking_id: bookingId, qr_status: "ACTIVE" },
      data:  { expires_at: now, qr_status: "CANCELLED", is_used: true },
    }).catch(() => {});
 
    const safeId = String(bookingId).replace(/:/g, "-");
 
    await Promise.allSettled([
      bookingQueue.getJob(`payment-timeout-${safeId}`).then(j => j?.remove()),
      bookingQueue.getJob(`no-show-${safeId}`).then(j => j?.remove()),
      notificationQueue.getJob(`reminder-1hr-${safeId}`).then(j => j?.remove()),
      notificationQueue.getJob(`reminder-15min-${safeId}`).then(j => j?.remove()),
    ]);
 
    // ── Slot release ──────────────────────────────────────────────────────────
    const cancelledDateStr = booking.service_date.toISOString().slice(0, 10);
 
    // Invalidate cache so next availability query sees the freed gap
    invalidateSlotCache(booking.staff_id, cancelledDateStr).catch(() => {});
 
    await redisClient.del(`slot_lock:${booking.staff_id}:${cancelledDateStr}`).catch(() => {});
 
    // ── Refund ────────────────────────────────────────────────────────────────
    if (wasPaid) {
      const payment = (booking as any).payment;
      if (payment?.razorpay_payment_id && payment?.status === "PAID") {
        await prisma.payment.update({
          where: { booking_id: bookingId },
          data:  {
            refund_amount: payment.amount,
            refund_status: "PROCESSING",
            refund_reason: dto.cancellation_reason ?? "Customer cancellation",
          },
        }).catch(() => {});
 
        const { refundQueue } = await import("../../../config/bullmq");
        await refundQueue.add(
          `refund-${safeId}`,
          {
            bookingId,
            paymentId: payment.razorpay_payment_id,
            amount:    payment.amount,
            reason:    dto.cancellation_reason ?? "Customer cancellation",
          },
          { jobId: `refund-${safeId}`, attempts: 5 },
        );
      }
    }
 
    // ── Notifications ─────────────────────────────────────────────────────────
    if (dto.cancellation_reason !== "USER_NAVIGATION") {
      await notificationQueue.add(
        `booking-cancelled-${safeId}`,
        { bookingId, type: "booking:cancelled" },
        { jobId: `booking-cancelled-${safeId}` },
      ).catch(err => logger.error("[cancelBooking] Failed to queue cancellation notification", err));
    }
 
    if (wasPaid) {
      queueEmail({
        to:   customer.user.email,
        type: "refund-confirmation",
        data: {
          customerName:  customer.name,
          businessName:  (booking as any).business?.business_name ?? "",
          bookingNumber: booking.booking_number,
          refundAmount:  (booking as any).payment?.amount ?? 0,
        },
      }).catch(() => {});
    }
 
    return { booking_id: bookingId, status: targetStatus };
  }
 

 
  static async getMyBookings(
    userId: string,
    opts:   { tab: string; page: number; limit: number },
  ): Promise<BookingListResponseDTO> {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");
 
    const { bookings, total } = await BookingRepository.findByCustomerTab(
      customer.id, opts.tab, opts.page, opts.limit,
    );
 
    if (opts.tab === "refund") {
      bookings.sort((a: any, b: any) => {
        const order: Record<string, number> = { REFUND_INITIATED: 0, REFUNDED: 1 };
        const ao = order[a.status as string] ?? 2;
        const bo = order[b.status as string] ?? 2;
        return ao !== bo ? ao - bo : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
 
    return {
      bookings: bookings.map(b => {
        const start = b.service_start_time;
        const bk    = b as any;
        return {
          id:                   b.id,
          booking_number:       b.booking_number,
          business_name:        bk.business.business_name,
          business_logo:        bk.business.logo_url      ?? null,
          staff: {
            name:       bk.staff.name,
            avatar_url: bk.staff.avatar_url ?? null,
          },
          service_date:         toTZDate(b.service_date),
          service_start_time:   toTZ(start),
          arrival_window_start: toTZ(deriveArrivalStart(start)),
          arrival_window_end:   toTZ(deriveArrivalEnd(start)),
          scan_window_end:      toTZ(deriveScanWindowEnd(start)),
          service_end_time:     toTZ(deriveServiceEnd(start, b.estimated_duration)),
          created_at:           b.created_at,
          // ADDED: drives "Arriving" vs "In Service" badge on BookingCard
          service_started_at: bk.service_started_at
            ? toTZ(bk.service_started_at) : null,
          actual_start_time: bk.service_started_at
            ? toTZ(bk.service_started_at) : null,
          actual_end_time: bk.service_completed_at
            ? toTZ(bk.service_completed_at) : null,
          status:           b.status,
          service_amount:   b.service_amount,
          services: Array.isArray(b.services)
            ? (b.services as any[]).map((s: any) => ({
                service_id:       s.service_id       ?? "",
                name:             s.name             ?? "",
                price:            s.price            ?? 0,
                duration_minutes: s.duration_minutes ?? 0,
                image_url:        s.image_url        ?? null,
              }))
            : [],
          refund_status:     bk.payment?.refund_status ?? null,
          refund_amount:     bk.payment?.refund_amount ?? null,
          cancellable_until: bk.cancellable_until
            ? toTZ(new Date(bk.cancellable_until)) : null,
          is_cancellable: bk.cancellable_until
            ? new Date() < new Date(bk.cancellable_until)
            : b.status === "PENDING_PAYMENT",
          //ADDED: drives "Leave Review" vs "Already Reviewed ★" on card footer
          has_review: !!(bk.review),
        };
      }),
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
 
    const b     = booking as any;
    const start = booking.service_start_time;
 
    return {
      id:                   booking.id,
      booking_number:       booking.booking_number,
      status:               booking.status,
      notes:                booking.notes              ?? null,
      cancellation_reason:  booking.cancellation_reason ?? null,
      cancelled_at:         booking.cancelled_at ? toTZ(booking.cancelled_at) : null,
      service_amount:       booking.service_amount,
      cancellable_until:    b.cancellable_until ? toTZ(new Date(b.cancellable_until)) : null,
      is_cancellable:       b.cancellable_until
        ? new Date() < new Date(b.cancellable_until)
        : booking.status === "PENDING_PAYMENT",
      service_date:         toTZDate(booking.service_date),
      service_start_time:   toTZ(start),
      arrival_window_start: toTZ(deriveArrivalStart(start)),
      arrival_window_end:   toTZ(deriveArrivalEnd(start)),
      // scan_window_end: QR countdown timer source — refetched on booking:time_updated
      scan_window_end:      toTZ(deriveScanWindowEnd(start)),
      service_end_time:     toTZ(deriveServiceEnd(start, booking.estimated_duration)),
      estimated_duration:   booking.estimated_duration,
      total_duration:       booking.total_duration,
      queue_number:         booking.queue_number,
      qr_image_url:         b.qr_code?.qr_image_url   ?? null,
      qr_expires_at:        b.qr_code?.expires_at ? toTZ(b.qr_code.expires_at) : null,
      business: {
        id:             b.business.id,
        business_name:  b.business.business_name,
        address_line1:  b.business.address_line1,
        city:           b.business.city,
        state:          b.business.state,
        map_link:       b.business.map_link       ?? null,
        business_phone: b.business.business_phone ?? null,
        logo_url:       b.business.logo_url       ?? null,
      },
      staff: {
        id:         b.staff.id,
        name:       b.staff.name,
        avatar_url: b.staff.avatar_url ?? null,
        phone:      b.staff.phone      ?? null,
      },
      services: Array.isArray(booking.services)
        ? (booking.services as any[]).map((s: any) => ({
            service_id:       s.service_id       ?? "",
            name:             s.name             ?? "",
            price:            s.price            ?? 0,
            duration_minutes: s.duration_minutes ?? 0,
            image_url:        s.image_url        ?? null,
          }))
        : [],
      payment: b.payment
        ? {
            id:                  b.payment.id,
            status:              b.payment.status,
            razorpay_payment_id: b.payment.razorpay_payment_id ?? null,
            paid_at:             b.payment.paid_at ? toTZ(b.payment.paid_at) : null,
            refund_status:       b.payment.refund_status ?? null,
            refund_amount:       b.payment.refund_amount ?? null,
          }
        : null,
      // ADDED: null = QR panel shown (Arriving); set = QR removed, "In Service" card shown
      service_started_at: b.service_started_at   ? toTZ(b.service_started_at)   : null,
      actual_start_time:  b.service_started_at   ? toTZ(b.service_started_at)   : null,
      actual_end_time:    b.service_completed_at ? toTZ(b.service_completed_at) : null,
      actual_duration:    b.actual_duration       ?? null,
      // ADDED: timeline row
      checked_in_at:      b.checked_in_at        ? toTZ(b.checked_in_at)        : null,
      // ADDED: modal footer — "Leave Review" vs "Already Reviewed ★"
      has_review: !!(b.review),
    };
  }

  // ── Private diagnostics ──────────────────────────────────────────────────────
  private static async _diagnoseSelectStaff(input: {
    business_id:          string;
    staff_id:             string;
    service_offering_ids: string[];
    service_date:         Date;
  }): Promise<{ reason: AvailabilityErrorReason; message: string }> {
    const specificMessage = await BookingRepository.diagnoseNoSlotsForStaff(input);
    const lower           = specificMessage.toLowerCase();
    let reason: AvailabilityErrorReason = "no_slots";

    if      (lower.includes("leave"))                                     reason = "on_leave";
    else if (lower.includes("does not work") || lower.includes("not available")) reason = "not_scheduled";
    else if (lower.includes("fully booked")  || lower.includes("queue"))  reason = "queue_overflow";

    return { reason, message: specificMessage };
  }

  private static async _diagnoseRandomNoSlots(input: {
    business_id:          string;
    service_offering_ids: string[];
    service_date:         Date;
  }): Promise<{ reason: AvailabilityErrorReason; message: string }> {
    const suggestion = await BookingRepository.suggestStaff(
      input.business_id,
      input.service_offering_ids,
      input.service_date,
    );

    const rawReason = suggestion.no_staff_reason ?? "no_slots";

    const reasonMap: Record<string, AvailabilityErrorReason> = {
      holiday:           "holiday",
      all_on_leave:      "all_on_leave",
      no_matching_staff: "no_slots",
      not_scheduled:     "not_scheduled",
      all_fully_booked:  "all_fully_booked",
      queue_overflow:    "queue_overflow",
      no_slots:          "no_slots",
    };

    const reason: AvailabilityErrorReason = reasonMap[rawReason] ?? "no_slots";

    const messageMap: Record<AvailabilityErrorReason, string> = {
      holiday:          "The business is closed on this date.",
      all_on_leave:     "All matching staff are on leave for this date.",
      not_scheduled:    "No staff are scheduled to work on this day.",
      all_fully_booked: "All matching staff are fully booked for this date.",
      queue_overflow:   "Queue extended beyond working hours due to delays.",
      no_slots:         suggestion.message ?? "No available slots for the selected date.",
      on_leave:         "This stylist is on leave.",
      past_date:        "Cannot book a date in the past.",
    };

    return { reason, message: messageMap[reason] };
  }
}
