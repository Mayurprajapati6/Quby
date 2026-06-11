import { prisma }        from "../../../config/prisma";
import { redisClient }   from "../../../config/redis";
import { emitToUser, emitToBusiness } from "../../../socket/socket.service";
import { settleQueue, notificationQueue, analyticsQueue } from "../../../config/bullmq";
import { addMinutes, set, add }   from "date-fns";
import { NotFoundError } from "../../../utils/errors/app.error";
import logger            from "../../../config/logger.config";
import { formatInTimeZone }   from "date-fns-tz";
import { invalidateSlotCache } from "../../../utils/cache/slotCache";
import {
  deriveArrivalWindowStart,
  deriveScanWindowEnd,
} from "../../../utils/helpers/timeWindows";

const IST       = "Asia/Kolkata";
const toIST     = (d: Date) => formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx");
const toISTMin  = (d: Date) => formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm");
const toISTTime = (d: Date) => formatInTimeZone(d, IST, "hh:mm a");

// Safe jobId segment — replaces colons with dashes
const toISTMinSafe = (d: Date) => toISTMin(d).replace(/:/g, "-");

const DEFAULT_BUFFER_MIN = 5;

export interface RebuildResult {
  shifted:    number;
  bookingIds: string[];
}

export class QueueRecalculationService {

  static async smartRebuildFromBooking(
    changedBookingId: string,
    staffId:          string,
    serviceDate:      Date,
    newEndTime:       Date,
    bufferMinutes:    number = DEFAULT_BUFFER_MIN,
  ): Promise<RebuildResult> {

    const changedBooking = await prisma.booking.findUnique({
      where:  { id: changedBookingId },
      select: { queue_number: true, business_id: true },
    });
    if (!changedBooking) return { shifted: 0, bookingIds: [] };

    const downstream = await prisma.booking.findMany({
      where: {
        staff_id:           staffId,
        service_date:       serviceDate,
        status:             { in: ["CONFIRMED", "RUNNING"] },
        service_started_at: null,
        service_start_time: { gt: newEndTime },
      },
      select: {
        id:                 true,
        booking_number:     true,
        service_start_time: true,
        estimated_duration: true,
        customer: {
          select: {
            id:   true,
            name: true,
            user: { select: { id: true } },
          },
        },
      },
      orderBy: { queue_number: "asc" },
    });

    if (downstream.length === 0) return { shifted: 0, bookingIds: [] };

    let rollingEnd = newEndTime;
    let shifted    = 0;
    const shiftedIds: string[] = [];

    for (const downstreamBooking of downstream) {
      const requiredStart = addMinutes(rollingEnd, bufferMinutes);
      const currentStart  = new Date(downstreamBooking.service_start_time);

      if (requiredStart > currentStart) {
        await prisma.booking.update({
          where: { id: downstreamBooking.id },
          data:  { service_start_time: requiredStart },
        });

        logger.info(
          `[QUEUE SHIFT] booking=${downstreamBooking.booking_number} old=${currentStart.toISOString()} new=${requiredStart.toISOString()}`
        );

        const timeKey    = toISTMinSafe(requiredStart);
        const shiftJobId = `queue-shifted-${downstreamBooking.id}-${timeKey}`;

        await notificationQueue.add(
          `queue-shifted-${downstreamBooking.id}`,
          {
            bookingId:  downstreamBooking.id,
            type:       "queue:shifted",
            newTime:    requiredStart.toISOString(),
            newTimeKey: toISTMin(requiredStart),
          },
          { jobId: shiftJobId },
        ).catch(err => logger.error(`[smartRebuild] notif enqueue FAILED for ${downstreamBooking.id}:`, err?.message));

        const customerUserId = downstreamBooking.customer?.user?.id;
        if (customerUserId) {
          emitToUser(customerUserId, "booking:updated", { bookingId: downstreamBooking.id });
        }

        emitToBusiness(changedBooking.business_id, "queue:updated", { staffId });

        shifted++;
        shiftedIds.push(downstreamBooking.id);
      }

      // Advance rollingEnd regardless of whether we shifted this booking
      const effectiveStart = requiredStart > currentStart ? requiredStart : currentStart;
      rollingEnd = addMinutes(effectiveStart, downstreamBooking.estimated_duration);
    }

    if (shifted > 0) {
      emitToBusiness(changedBooking.business_id, "queue:updated", { staffId });
      logger.info(`[QueueRecalc] smartRebuild: ${shifted} shifted downstream of ${changedBookingId}`);
    }

    await invalidateSlotCache(
      staffId,
      serviceDate.toISOString().slice(0, 10),
    ).catch(err => logger.error("[CACHE INVALIDATION FAILED]", err));

    return { shifted, bookingIds: shiftedIds };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // rebuildQueue — resequences all CONFIRMED/RUNNING bookings for the day
  // ═══════════════════════════════════════════════════════════════════════════
  static async rebuildQueue(staffId: string, serviceDate: Date): Promise<void> {
    const bookings = await prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: serviceDate,
        status:       { in: ["RUNNING", "CONFIRMED"] },
      },
      select: {
        id:                 true,
        status:             true,
        queue_number:       true,
        service_start_time: true,
        service_started_at: true,
        estimated_duration: true,
        business_id:        true,
        customer:           { select: { id: true, user: { select: { id: true } } } },
      },
      orderBy: { queue_number: "asc" },
    });

    if (bookings.length === 0) return;

    const businessId: string     = bookings[0]?.business_id ?? "";
    let   prevEnd:    Date | null = null;
    let   shiftedCount            = 0;

    for (const b of bookings) {
      if (b.status === "RUNNING") {
        const scheduledStart: Date = new Date(b.service_start_time);
        const actualStart:    Date = b.service_started_at
          ? new Date(b.service_started_at)
          : scheduledStart;
        const effectiveStart: Date = actualStart > scheduledStart ? actualStart : scheduledStart;
        prevEnd = addMinutes(effectiveStart, b.estimated_duration);
        continue;
      }

      const scheduledStart: Date = new Date(b.service_start_time);

      if (!prevEnd) {
        prevEnd = addMinutes(scheduledStart, b.estimated_duration);
        continue;
      }

      const requiredStart: Date = addMinutes(prevEnd, DEFAULT_BUFFER_MIN);
      const diffMs              = requiredStart.getTime() - scheduledStart.getTime();
      if (diffMs <= 60_000) {
        prevEnd = addMinutes(scheduledStart, b.estimated_duration);
        continue;
      }

      const newStart:        Date   = requiredStart;
      const newArrivalStart: Date   = addMinutes(newStart, -15);
      const newArrivalEnd:   Date   = newStart;
      const newScanEnd:      Date   = addMinutes(newStart, 10);
      const newTimeIST:      string = toIST(newStart);
      const newTimeKeySafe:  string = toISTMinSafe(newStart);
      const newTimeKey:      string = toISTMin(newStart);

      await prisma.booking.update({
        where: { id: b.id },
        data:  { service_start_time: newStart },
      });

      const custUserId = b.customer?.user?.id;
      if (custUserId) {
        emitToUser(custUserId, "booking:time_updated", {
          bookingId:           b.id,
          newServiceStartTime: newTimeIST,
          newArrivalStart:     toIST(newArrivalStart),
          newArrivalEnd:       toIST(newArrivalEnd),
          newScanWindowEnd:    toIST(newScanEnd),
          message:             `Your appointment has been delayed to ${toISTTime(newStart)}.`,
        });
      }

      emitToBusiness(businessId, "booking:time_updated", {
        bookingId:           b.id,
        newServiceStartTime: newTimeIST,
        newArrivalStart:     toIST(newArrivalStart),
        newArrivalEnd:       toIST(newArrivalEnd),
        newScanWindowEnd:    toIST(newScanEnd),
      });

      await notificationQueue.add(
        `queue-shifted-${b.id}`,
        {
          bookingId: b.id,
          type:      "queue:shifted",
          newTime:   newTimeIST,
          newTimeKey,
        },
        { jobId: `queue-shifted-${b.id}-${newTimeKeySafe}` },
      ).catch(err => logger.error(`[rebuildQueue] notif enqueue error for ${b.id}:`, err?.message));

      shiftedCount++;
      prevEnd = addMinutes(newStart, b.estimated_duration);
      logger.info(`[QueueRecalc] rebuildQueue: shifted ${b.id} → ${newTimeIST}`);
    }

    if (shiftedCount > 0) {
      emitToBusiness(businessId, "queue:updated", { staffId });
    }
  }

  
  static async autoMoveNextToRunning(
    staffId:     string,
    serviceDate: Date,
    forceNext =  false,
  ): Promise<{ moved: boolean; bookingId?: string }> {
    const now   = new Date();
    const nowMs = now.getTime();

    // FIX 1: Check for ANY RUNNING booking — scanned OR awaiting scan.
    // Both states occupy the single running slot.
    // DO NOT filter by service_started_at here.
    const runningExists = await prisma.booking.findFirst({
      where:  {
        staff_id:     staffId,
        service_date: serviceDate,
        status:       "RUNNING",
        // No service_started_at filter — both awaiting and in-progress block the slot
      },
      select: { id: true },
    });
    if (runningExists) return { moved: false };

    // Find the next CONFIRMED booking in queue order
    const next = await prisma.booking.findFirst({
      where:   { staff_id: staffId, service_date: serviceDate, status: "CONFIRMED" },
      orderBy: { queue_number: "asc" },
    });
    if (!next) return { moved: false };

    // FIX 2: Raw ms comparison — arrival window opens at service_start_time - 15min
    const arrivalWindowStartMs = deriveArrivalWindowStart(next.service_start_time).getTime();
    const scanEndMs            = deriveScanWindowEnd(next.service_start_time).getTime();

    // Don't move if arrival window hasn't opened yet (unless forced after completion)
    if (!forceNext && nowMs < arrivalWindowStartMs) return { moved: false };

    // Don't move if scan window has already expired (should have been NO_SHOW already)
    if (!forceNext && nowMs > scanEndMs) {
      logger.warn(`[autoMove] Skipping ${next.id} — scan window already expired`);
      return { moved: false };
    }

    // Move the booking to RUNNING (awaiting QR scan)
    await prisma.booking.update({
      where: { id: next.id },
      data:  { status: "RUNNING" },
    });

    const full = await prisma.booking.findUnique({
      where:  { id: next.id },
      select: {
        business_id: true,
        staff_id:    true,
        customer:    { select: { user: { select: { id: true } } } },
      },
    });

    if (full) {
      emitToBusiness(full.business_id, "queue:updated", { staffId: full.staff_id });
      const custUserId = (full.customer as any)?.user?.id;
      if (custUserId) {
        emitToUser(custUserId, "booking:updated", {
          bookingId:          next.id,
          status:             "RUNNING",
          service_started_at: null,
        });
      }
    }

    logger.info(`[QueueRecalc] autoMove: ${next.id} → RUNNING (awaiting QR scan, forced=${forceNext})`);
    return { moved: true, bookingId: next.id };
  }

  static async markNoShowsForExpiredWindows(
    staffId: string,
    start:   Date,
    end:     Date,
  ): Promise<boolean> {
    const now   = new Date();
    const nowMs = now.getTime();  // raw ms — no rounding
    let anyNoShow = false;
    const noShowBookings: { id: string; business_id: string }[] = [];

    const bookings = await prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: { gte: start, lte: end },
        status:       { in: ["CONFIRMED", "RUNNING"] },
      },
      select: {
        id:                 true,
        status:             true,
        business_id:        true,
        service_start_time: true,
        service_started_at: true,
        queue_number:       true,
      },
      orderBy: { queue_number: "asc" },
    });

    for (const b of bookings) {
      // RUNNING + service_started_at set = in progress, NEVER mark no-show
      if (b.status === "RUNNING" && b.service_started_at !== null) continue;

      // FIX: raw ms comparison — no rounding, fires at exact millisecond
      const scanEndMs = deriveScanWindowEnd(b.service_start_time).getTime();
      if (nowMs <= scanEndMs) continue;  // scan window still open

      // Atomic update — only succeeds if status hasn't changed
      const result = await prisma.booking.updateMany({
        where: {
          id:                 b.id,
          status:             { in: ["CONFIRMED", "RUNNING"] },
          service_started_at: null,
        },
        data: { status: "NO_SHOW", cancelled_at: now },
      });

      if (result.count === 0) {
        // Status changed between our read and write (e.g. staff just scanned)
        logger.info(`[markNoShows] ${b.id} skipped — status changed or scan happened concurrently`);
        continue;
      }

      logger.info(`[NO_SHOW] ${b.id} (was ${b.status}) marked NO_SHOW — scanEnd was ${new Date(scanEndMs).toISOString()}, now=${now.toISOString()}`);

      await settleQueue.add(
        `settle-noshow-${b.id}`,
        { bookingId: b.id },
        { jobId: `settle-noshow-${b.id}` },
      ).catch(err => logger.error(`[markNoShows] settleQueue enqueue FAILED for ${b.id}:`, err?.message));

      await notificationQueue.add(
        `booking-no-show-${b.id}`,
        { bookingId: b.id, type: "booking:no_show" },
        { jobId: `booking-no-show-${b.id}` },
      ).catch(err => logger.error(`[markNoShows] notificationQueue enqueue FAILED for ${b.id}:`, err?.message));

      await analyticsQueue.add(
        `analytics-no-show-${b.id}`,
        { type: "booking-cancelled", bookingId: b.id, businessId: b.business_id },
        { jobId: `analytics-no-show-${b.id}` },
      ).catch(err => logger.error(`[markNoShows] analyticsQueue enqueue FAILED for ${b.id}:`, err?.message));

      emitToBusiness(b.business_id, "booking:no_show", {
        bookingId: b.id,
        noShowAt:  now.toISOString(),
      });

      noShowBookings.push({ id: b.id, business_id: b.business_id });
      anyNoShow = true;
    }

    if (anyNoShow) {
      await this.rebuildQueue(staffId, start);
      const businessId = noShowBookings[0]?.business_id;
      if (businessId) emitToBusiness(businessId, "queue:updated", { staffId });
    }

    return anyNoShow;
  }

  static async handleLateScan(
    bookingId:     string,
    staffId:       string,
    serviceDate:   Date,
    actualStart:   Date,
    duration:      number,
    bufferMinutes: number = DEFAULT_BUFFER_MIN,
  ): Promise<RebuildResult> {
    const newEnd: Date = addMinutes(actualStart, duration);
    const result = await this.smartRebuildFromBooking(
      bookingId, staffId, serviceDate, newEnd, bufferMinutes,
    );
    if (result.shifted > 0) {
      logger.info(`[QueueRecalc] handleLateScan: ${result.shifted} downstream shifted for ${bookingId}`);
    }
    return result;
  }

  static async handleExtend(
    bookingId:     string,
    staffId:       string,
    serviceDate:   Date,
    extraMinutes:  number,
    bufferMinutes: number = DEFAULT_BUFFER_MIN,
  ): Promise<RebuildResult> {
    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: {
        estimated_duration: true,
        service_started_at: true,
        service_start_time: true,
        business_id:        true,
      },
    });
    if (!booking) throw new NotFoundError("Booking not found.");

    const newDuration: number  = booking.estimated_duration + extraMinutes;
    const effectiveStart: Date = booking.service_started_at
      ? new Date(booking.service_started_at)
      : new Date(booking.service_start_time);
    const newEnd: Date         = addMinutes(effectiveStart, newDuration);

    await prisma.booking.update({
      where: { id: bookingId },
      data:  { estimated_duration: newDuration },
    });

    const ts = Date.now();
    await notificationQueue.add(
      `service-extended-${bookingId}`,
      {
        bookingId,
        type:         "service:extended",
        extraMinutes,
      },
      { jobId: `service-extended-${bookingId}-${extraMinutes}min-${ts}` },
    ).catch(err => logger.error(`[handleExtend] notif enqueue FAILED for ${bookingId}:`, err?.message));

    emitToBusiness(booking.business_id, "queue:extended", { bookingId, extraMinutes, newDuration });
    emitToBusiness(booking.business_id, "queue:updated",  { staffId });

    const result = await this.smartRebuildFromBooking(
      bookingId, staffId, serviceDate, newEnd, bufferMinutes,
    );

    logger.info(`[QueueRecalc] handleExtend: +${extraMinutes}min newEnd=${toIST(newEnd)}, shifted=${result.shifted}`);
    return result;
  }

  static async handleComplete(
    bookingId:   string,
    staffId:     string,
    serviceDate: Date,
  ): Promise<void> {
    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: { id: true, status: true, business_id: true, staff_id: true },
    });
    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.status === "COMPLETED") {
      logger.warn(`[handleComplete] ${bookingId} already COMPLETED`);
      return;
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data:  { status: "COMPLETED", completed_at: new Date() },
    });

    logger.info(`[handleComplete] ${bookingId} → COMPLETED`);

    const ts = Date.now();
    await notificationQueue.add(
      `booking-completed-${bookingId}`,
      { bookingId, type: "booking:completed" },
      { jobId: `booking-completed-${bookingId}-${ts}` },
    ).catch(err => logger.error(`[handleComplete] notif enqueue FAILED for ${bookingId}:`, err?.message));

    await settleQueue.add(
      `settle-complete-${bookingId}`,
      { bookingId, type: "settle-completed" },
      { jobId: `settle-complete-${bookingId}` },
    ).catch(err => logger.error(`[handleComplete] settleQueue enqueue FAILED for ${bookingId}:`, err?.message));

    emitToBusiness(booking.business_id, "service:completed", { bookingId, staffId });

    await this.handleEarlyFinish(staffId, serviceDate);
  }

  static async handleTimerOverrun(
    bookingId:    string,
    businessId:   string,
    staffId:      string,
    overrunSince: Date,
  ): Promise<void> {
    const throttleKey = `overrun-emitted-${bookingId}`;
    if (await redisClient.get(throttleKey)) return;
    await (redisClient as any).set(throttleKey, "1", "EX", 60);

    emitToBusiness(businessId, "service:overdue", {
      bookingId,
      staffId,
      overrunSince: overrunSince.toISOString(),
    });

    await notificationQueue.add(
      `service-overrun-${bookingId}`,
      {
        bookingId,
        type:         "service:overrun",
        overrunSince: overrunSince.toISOString(),
      },
      { jobId: `service-overrun-${bookingId}` },
    ).catch(err => logger.error(`[handleTimerOverrun] notif enqueue FAILED for ${bookingId}:`, err?.message));

    logger.info(`[QueueRecalc] handleTimerOverrun: overrun notification enqueued for ${bookingId}`);
  }

  static async handleEarlyFinish(staffId: string, serviceDate: Date): Promise<void> {
    await this.autoMoveNextToRunning(staffId, serviceDate, true);
  }

  static async rebuildRedisQueue(staffId: string, date: string): Promise<void> {
    const bookings = await prisma.booking.findMany({
      where:   {
        staff_id:     staffId,
        service_date: new Date(date),
        status:       { in: ["CONFIRMED", "PENDING_PAYMENT", "RUNNING"] },
      },
      orderBy: { queue_number: "asc" },
    });
    if (bookings.length === 0) return;

    const key  = `queue-staff-${staffId}-${date}`;
    const args: (string | number)[] = [];
    for (const b of bookings) args.push(b.queue_number, b.id);
    await (redisClient as any).zadd(key, ...args);

    const midnight = set(add(new Date(date), { days: 1 }), { hours: 0, minutes: 0, seconds: 0 });
    await (redisClient as any).expireat(key, Math.floor(midnight.getTime() / 1000));
  }
}
