import { prisma }        from "../../../config/prisma";
import { StaffQueueRepository } from "./staff-queue.repository";
import { emitToUser, emitToBusiness } from "../../../socket/socket.service";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../utils/errors/app.error";
import logger            from "../../../config/logger.config";
import { formatInTimeZone } from "date-fns-tz";
import { addMinutes }    from "date-fns";
import { invalidateSlotCache } from "../../../utils/cache/slotCache";
import { settleQueue, analyticsQueue, notificationQueue } from "../../../config/bullmq";
import {
  bookingWindowStart,
  deriveArrivalWindowEnd,
  deriveArrivalWindowStart,
  deriveScanWindowEnd,
  deriveServiceEnd,
} from "../../../utils/helpers/timeWindows";

const IST = "Asia/Kolkata";
const toIST     = (d: Date) => formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx");
const toISTDate = (d: Date) => formatInTimeZone(d, IST, "yyyy-MM-dd");

function toQueueItem(b: any) {
  const rawStart           = new Date(b.service_start_time);
  const start              = bookingWindowStart(rawStart);
  const arrivalWindowStart = deriveArrivalWindowStart(rawStart);
  const arrivalWindowEnd   = deriveArrivalWindowEnd(rawStart);
  const serviceEnd         = deriveServiceEnd(rawStart, b.estimated_duration);
  return {
    id:                   b.id,
    booking_number:       b.booking_number,
    queue_number:         b.queue_number,
    status:               b.status,
    service_date:         toISTDate(b.service_date),
    service_start_time:   toIST(start),
    arrival_window_start: toIST(arrivalWindowStart),
    arrival_window_end:   toIST(arrivalWindowEnd),
    service_end_time:     toIST(serviceEnd),
    // FIX: scan_window_end is service_start_time + 10min — raw ms comparison, no rounding
    scan_window_end:      toIST(deriveScanWindowEnd(rawStart)),
    checked_in_at:        b.checked_in_at        ? toIST(new Date(b.checked_in_at))        : null,
    service_started_at:   b.service_started_at   ? toIST(new Date(b.service_started_at))   : null,
    service_completed_at: b.service_completed_at ? toIST(new Date(b.service_completed_at)) : null,
    estimated_duration:   b.estimated_duration,
    actual_duration:      b.actual_duration ?? null,
    services: Array.isArray(b.services)
      ? b.services.map((s: any) => ({ name: s.name, duration: s.duration_minutes, image: s.image_url || null }))
      : [],
    customer: {
      id:         b.customer.id,
      name:       b.customer.name,
      phone:      b.customer.phone      ?? null,
      avatar_url: b.customer.avatar_url ?? null,
    },
  };
}

export class StaffQueueService {

  private static async resolveStaff(userId: string) {
    const staff = await prisma.staff.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true, business_id: true, is_active: true },
    });
    if (!staff)           throw new NotFoundError("Staff profile not found.");
    if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");
    return staff;
  }

  static async getTodayQueue(userId: string) {
    const staff = await this.resolveStaff(userId);
    const now   = new Date();

    const istDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const today      = new Date(istDateStr + "T00:00:00+05:30");
    const end        = new Date(istDateStr + "T23:59:59+05:30");

    const { QueueRecalculationService } = await import("../queue/queue-recalculation.service");

    const noShowTriggered = await QueueRecalculationService
      .markNoShowsForExpiredWindows(staff.id, today, end)
      .catch(err => {
        logger.warn("[StaffQueue] markNoShows failed:", err?.message);
        return false;
      });

    const moved = await QueueRecalculationService
      .autoMoveNextToRunning(staff.id, today)
      .catch(() => ({ moved: false }));

    const shouldEmit = noShowTriggered || (moved as any).moved;
    if (shouldEmit) {
      emitToBusiness(staff.business_id, "queue:updated", { staffId: staff.id });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        staff_id:     staff.id,
        service_date: { gte: today, lte: end },
        status:       { in: ["RUNNING", "CONFIRMED"] },
        is_visible:   { not: false },
      },
      select: {
        id:                   true,
        booking_number:       true,
        queue_number:         true,
        status:               true,
        service_date:         true,
        service_start_time:   true,
        estimated_duration:   true,
        services:             true,
        checked_in_at:        true,
        service_started_at:   true,
        service_completed_at: true,
        actual_duration:      true,
        customer: { select: { id: true, name: true, avatar_url: true, phone: true } },
      },
      orderBy: { queue_number: "asc" },
    });

    const runningBooking = bookings.find(b => b.status === "RUNNING" && b.service_started_at);
    if (runningBooking?.service_started_at) {
      const expectedEnd = addMinutes(new Date(runningBooking.service_started_at), runningBooking.estimated_duration);
      if (now > expectedEnd) {
        await QueueRecalculationService.handleTimerOverrun(
          runningBooking.id,
          staff.business_id,
          staff.id,
          expectedEnd,
        ).catch(() => {});
      }
    }

    const completedBookings = await prisma.booking.findMany({
      where: {
        staff_id:             staff.id,
        service_date:         { gte: today, lte: end },
        status:               "COMPLETED",
        is_visible:           { not: false },
        service_completed_at: { gte: today, lte: end },
      },
      select: {
        id:                   true,
        booking_number:       true,
        queue_number:         true,
        status:               true,
        service_date:         true,
        service_start_time:   true,
        estimated_duration:   true,
        services:             true,
        checked_in_at:        true,
        service_started_at:   true,
        service_completed_at: true,
        actual_duration:      true,
        customer: { select: { id: true, name: true, avatar_url: true, phone: true } },
      },
      orderBy: { service_completed_at: "desc" },
      take:    20,
    });

    const running:   any[] = [];
    const upcoming:  any[] = [];
    const completed: any[] = [];

    for (const b of bookings) {
      (b.status === "RUNNING" ? running : upcoming).push(toQueueItem(b));
    }
    for (const b of completedBookings) {
      completed.push(toQueueItem(b));
    }

    running.sort((a, b)  => a.queue_number - b.queue_number);
    upcoming.sort((a, b) => a.queue_number - b.queue_number);

    return {
      running,
      upcoming,
      completed,
      served_today: completedBookings.length,
      staff_id:     staff.id,
      // ✅ server_now: used by frontend for clock sync (EWMA offset)
      server_now: new Date().toISOString(),
    };
  }

  static async getQueueByDate(userId: string, dateStr: string) {
    const staff = await this.resolveStaff(userId);
    const date  = new Date(`${dateStr}T00:00:00+05:30`);
    if (isNaN(date.getTime())) throw new BadRequestError("Invalid date. Use YYYY-MM-DD.");

    const bookings = await StaffQueueRepository.findQueueByDate(staff.id, date);
    return bookings.map(b => ({
      id:                   b.id,
      booking_number:       b.booking_number,
      queue_number:         b.queue_number,
      status:               b.status,
      service_date:         toISTDate(b.service_date),
      service_start_time:   toIST(b.service_start_time),
      arrival_window_start: toIST(deriveArrivalWindowStart(b.service_start_time)),
      arrival_window_end:   toIST(deriveArrivalWindowEnd(b.service_start_time)),
      scan_window_end:      toIST(deriveScanWindowEnd(b.service_start_time)),
      services: Array.isArray(b.services) ? (b.services as any[]).map((s: any) => s.name ?? "") : [],
      customer_name: (b as any).customer.name,
    }));
  }

  static async scanQr(userId: string, qrCodeId: string) {
    const { StaffBookingActionsService } = await import("../bookings/staff-booking-actions.service");
    const qr = await prisma.qRCode.findUnique({ where: { qr_code_id: qrCodeId }, select: { booking_id: true } });
    if (!qr) throw new NotFoundError("QR code not found.");
    return StaffBookingActionsService.scanBooking(userId, qr.booking_id, qrCodeId, "CAMERA");
  }

  // ─────────────────────────────────────────────────────────────────
  static async completeService(userId: string, bookingId: string) {
    const staff   = await this.resolveStaff(userId);
    const booking = await StaffQueueRepository.findBookingById(bookingId, staff.id);
    if (!booking) throw new NotFoundError("Booking not found.");

    if (booking.status !== "RUNNING") {
      throw new BadRequestError(`Cannot complete booking with status: ${booking.status}.`);
    }

    if (!booking.service_started_at) {
      throw new BadRequestError("Service has not been started yet. Scan the customer's QR code first.");
    }

    const actualEnd = new Date();
    const actualMin = Math.round(
      (actualEnd.getTime() - new Date(booking.service_started_at).getTime()) / 60000
    );

    await StaffQueueRepository.markCompleteWithDuration(bookingId, actualMin);

    const { QueueRecalculationService } = await import("../queue/queue-recalculation.service");

    const scheduledEnd  = addMinutes(new Date(booking.service_start_time), booking.estimated_duration);
    const isEarlyFinish = actualEnd < scheduledEnd;

    if (isEarlyFinish) {
      await QueueRecalculationService.handleEarlyFinish(booking.staff_id, booking.service_date);
    } else {
      await QueueRecalculationService.rebuildQueue(booking.staff_id, booking.service_date);
      await QueueRecalculationService.autoMoveNextToRunning(booking.staff_id, booking.service_date, true);
    }

    const ts = Date.now();
    await notificationQueue.add(
      `booking-completed-${bookingId}`,
      { bookingId, type: "booking:completed" },
      { jobId: `booking-completed-${bookingId}-${ts}` },
    ).catch(() => {});

    const payment = (booking as any).payment;
    if (payment?.status === "PAID") {
      logger.info(`[COMPLETE] enqueue settlement for ${bookingId}`);
      const settlTs = Date.now();
      settleQueue.add(
        `settle-complete-${bookingId}-${settlTs}`,
        { bookingId },
        {
          delay: 0,
          jobId: `settle-complete-${bookingId}-${settlTs}`,
          removeOnComplete: true,
          removeOnFail: 1000,
          attempts: 5,
        },
      ).catch(() => {});
    }

    const customerUserId = (booking as any).customer?.user?.id;
    if (customerUserId) {
      emitToUser(customerUserId, "booking:updated", { bookingId, status: "COMPLETED" });
    }

    invalidateSlotCache(staff.id, booking.service_date.toISOString().slice(0, 10)).catch(() => {});

    analyticsQueue.add(
      `analytics-booking-completed-${bookingId}`,
      { type: "booking:completed", bookingId, staffId: staff.id, businessId: staff.business_id },
      { jobId: `analytics-booking-completed-${bookingId}` },
    ).catch(() => {});

    emitToBusiness(staff.business_id, "queue:updated", { staffId: staff.id });

    logger.info(`[StaffQueue] Completed ${bookingId}, actual=${actualMin}min, early=${isEarlyFinish}`);

    return { bookingId, status: "COMPLETED", actual_duration_minutes: actualMin };
  }

  static async extendService(userId: string, bookingId: string, minutes: number) {
    const staff   = await this.resolveStaff(userId);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking)                      throw new NotFoundError("Booking not found.");
    if (booking.staff_id !== staff.id) throw new ForbiddenError("Not your booking.");
    if (booking.status !== "RUNNING")  throw new BadRequestError("Only a RUNNING booking can be extended.");
    if (!booking.service_started_at)   throw new BadRequestError("Service has not been started yet. Scan the customer's QR code first.");
    if (minutes < 5 || minutes > 120)  throw new BadRequestError("Extension must be between 5 and 120 minutes.");

    const { QueueRecalculationService } = await import("../queue/queue-recalculation.service");

    
    console.log("\n========== EXTEND REQUEST DEBUG ==========");
console.log("bookingId:", bookingId);
console.log("staffId:", staff.id);
console.log("serviceDate:", booking.service_date);
console.log("minutes:", minutes);
console.log("currentEstimatedDuration:", booking.estimated_duration);
console.log("serviceStartedAt:", booking.service_started_at);
console.log("==========================================\n");

    logger.info(`[EXTEND REQUEST] booking=${bookingId} extendBy=${minutes}`);

    const result = await QueueRecalculationService.handleExtend(
      bookingId,
      staff.id,
      booking.service_date,
      minutes,
    );

    const newDuration = booking.estimated_duration + minutes;

    const custUserId = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: { customer: { select: { user: { select: { id: true } } } } },
    }).then(b => (b?.customer as any)?.user?.id);

    if (custUserId) {
      emitToUser(custUserId, "booking:updated", {
        bookingId,
        status:      "RUNNING",
        extraMinutes: minutes,
        newDuration,
      });
    }

    logger.info(`[StaffQueue] Extended ${bookingId} by ${minutes}min → ${newDuration}min, shifted ${result.shifted} downstream`);

    return {
      bookingId,
      extraMinutes: minutes,
      newDuration,
      downstreamShifted: result.shifted,
    };
  }
}
