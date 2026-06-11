import { prisma }        from "../../../config/prisma";
import { settleQueue, notificationQueue, analyticsQueue } from "../../../config/bullmq";
import { emitToUser, emitToBusiness } from "../../../socket/socket.service";
import { addMinutes, differenceInMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import { verifyQrSignature } from "../../payment/payment.service";
import { invalidateSlotCache } from "../../../utils/cache/slotCache";
import {
  bookingWindowStart,
  deriveArrivalWindowStart,
  deriveScanWindowEnd,
} from "../../../utils/helpers/timeWindows";

const TZ        = "Asia/Kolkata";
const toTZ      = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx");
const toIST     = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd HH:mm:ss");
const toISTTime = (d: Date) => formatInTimeZone(d, TZ, "hh:mm a");

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ["RUNNING"],
  RUNNING:   ["COMPLETED"],
};

function normalizeQrId(raw: string): string {
  const value = raw.trim();
  if (!value) return value;

  try {
    const parsed = JSON.parse(value);
    return String(parsed.qr_id ?? parsed.qrId ?? parsed.qr_code_id ?? parsed.qrCodeId ?? value).trim();
  } catch {}

  try {
    const url = new URL(value);
    return (
      url.searchParams.get("qr_id") ??
      url.searchParams.get("qrId") ??
      url.searchParams.get("qr_code_id") ??
      value
    ).trim();
  } catch {}

  return value;
}

async function resolveStaff(userId: string) {
  const staff = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, name: true, business_id: true, user_id: true },
  });
  if (!staff) throw new NotFoundError("Staff profile not found.");
  return staff;
}

export class StaffBookingActionsService {

  static async scanBooking(
    userId:     string,
    bookingId:  string,
    rawQrId:    string,
    scanMethod: "CAMERA" | "MANUAL" = "CAMERA",
  ) {
    const staff = await resolveStaff(userId);
    const now   = new Date();
    const qrId  = normalizeQrId(rawQrId);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        qr_code:  true,
        customer: { select: { id: true, name: true, user: { select: { id: true, email: true } } } },
        business: { select: { id: true, business_name: true } },
      },
    });

    if (!booking)                      throw new NotFoundError("Booking not found.");
    if (booking.staff_id !== staff.id) throw new ForbiddenError("This booking is not assigned to you.");
    if (!booking.qr_code)              throw new BadRequestError("No QR code found for this booking.");

    const qr = booking.qr_code;

    if (qr.booking_id !== bookingId) {
      await prisma.qrScanLog.create({
        data: { booking_id: bookingId, qr_code_id: qr.id, staff_id: staff.id, scan_result: "INVALID_QR_ID", scan_method: scanMethod },
      }).catch(() => {});
      throw new BadRequestError("This QR does not belong to this booking.");
    }

    if (qr.qr_code_id !== qrId) {
      const scannedQr = await prisma.qRCode.findUnique({
        where: { qr_code_id: qrId },
        select: { id: true, booking_id: true },
      });
      await prisma.qrScanLog.create({
        data: { booking_id: bookingId, qr_code_id: scannedQr?.id ?? qr.id, staff_id: staff.id, scan_result: "INVALID_QR_ID", scan_method: scanMethod },
      }).catch(() => {});
      if (scannedQr?.booking_id && scannedQr.booking_id !== bookingId) {
        throw new BadRequestError("This QR belongs to a different booking.");
      }
      throw new BadRequestError("No active QR code matches this booking. Ask the customer to show the latest booking QR.");
    }

    const active = await prisma.booking.findFirst({
      where: {
        staff_id:     staff.id,
        service_date: booking.service_date,
        status:       "RUNNING",
        is_visible:   { not: false },
      },
    });
    if (active && active.id !== bookingId) {
      throw new BadRequestError("Another service is already in progress. Complete it before scanning a new one.");
    }

    if (!verifyQrSignature(qr.qr_data)) {
      await prisma.qrScanLog.create({
        data: { booking_id: bookingId, qr_code_id: qr.id, staff_id: staff.id, scan_result: "INVALID_SIGNATURE", scan_method: scanMethod },
      }).catch(() => {});
      throw new BadRequestError("QR code signature is invalid. Ask the customer to refresh their QR.");
    }

    if (qr.qr_status === "USED" || qr.is_used) {
      await prisma.qrScanLog.create({
        data: { booking_id: bookingId, qr_code_id: qr.id, staff_id: staff.id, scan_result: "ALREADY_USED", scan_method: scanMethod },
      }).catch(() => {});
      throw new BadRequestError("This QR code has already been scanned for this booking.");
    }

    // ── Scan window check ──────────────────────────────────────────
    const serviceStart    = bookingWindowStart(new Date(booking.service_start_time));
    const scanWindowStart = deriveArrivalWindowStart(booking.service_start_time);
    const scanWindowEnd   = deriveScanWindowEnd(booking.service_start_time);

    // Too early
    if (now < scanWindowStart) {
      throw new BadRequestError(
        `Scan window not open yet. Opens at ${toISTTime(scanWindowStart)} (15 min before appointment).`
      );
    }

    // Too late → NO_SHOW
    if (now >= scanWindowEnd) {
      await prisma.$transaction(async (tx) => {
        if (booking.status === "CONFIRMED" || booking.status === "RUNNING") {
          await tx.booking.update({
            where: { id: bookingId },
            data:  { status: "NO_SHOW", cancelled_at: now },
          });
          // FIX: jobId uses dashes — "settle-${id}" not "settle:${id}"
          await settleQueue.add(`settle-noshow-${bookingId}`, { bookingId }, { jobId: `settle-noshow-${bookingId}` }).catch(() => {});
        }
        await tx.qRCode.update({ where: { id: qr.id }, data: { qr_status: "EXPIRED" } });
      });

      const { QueueRecalculationService } = await import("../queue/queue-recalculation.service");
      await QueueRecalculationService.rebuildQueue(booking.staff_id, booking.service_date);

      // FIX: jobId "booking-no-show-${id}" — no colons
      await notificationQueue.add(
        `booking-no-show-${bookingId}`,
        { bookingId, type: "booking:no_show" },
        { jobId: `booking-no-show-${bookingId}` },
      ).catch(() => {});

      emitToBusiness(booking.business_id, "booking:no_show", {
        bookingId,
        noShowAt: now.toISOString(),
      });

      throw new BadRequestError(
        `Scan window closed at ${toISTTime(scanWindowEnd)}. This booking has been marked as No Show.`
      );
    }

    // ── Guard: already started / no-show ──────────────────────────
    if (booking.status === "RUNNING" && booking.service_started_at) {
      throw new BadRequestError("This service has already been started.");
    }
    if (booking.status === "NO_SHOW") {
      throw new BadRequestError("This booking was already marked as No Show.");
    }
    if (booking.status === "COMPLETED") {
      throw new BadRequestError("This booking is already completed.");
    }
    if (booking.status !== "CONFIRMED" && booking.status !== "RUNNING") {
      throw new BadRequestError(`Cannot start service. Booking status is: ${booking.status}.`);
    }

    // ── Start service (atomic) ─────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      await tx.qRCode.update({
        where: { id: qr.id },
        data:  { qr_status: "USED", is_used: true, used_at: now },
      });

      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: { in: ["CONFIRMED", "RUNNING"] } },
        data:  {
          status:             "RUNNING",
          service_started_at: now,
          checked_in_at:      now,
        },
      });
      if (updated.count === 0) throw new BadRequestError("Booking could not be started. Please try again.");

      await tx.qrScanLog.create({
        data: { booking_id: bookingId, qr_code_id: qr.id, staff_id: staff.id, scan_result: "VALID", scan_method: scanMethod },
      });
    });

    // ── Late scan detection ────────────────────────────────────────
    const isLate       = now > serviceStart;
    const delayMinutes = isLate ? differenceInMinutes(now, serviceStart) : 0;

    logger.info(`[SCAN] ${bookingId}: scheduled=${toIST(serviceStart)}, scanned=${toIST(now)}, late=${isLate}, delayMin=${delayMinutes}`);

    if (isLate) {
      const { QueueRecalculationService } = await import("../queue/queue-recalculation.service");

      const actualEnd = addMinutes(now, booking.estimated_duration);

      console.log("\n========== LATE SCAN DEBUG ==========");
      console.log("bookingId:", booking.id);
      console.log("scheduledStart:", serviceStart.toISOString());
      console.log("actualStart:", now.toISOString());
      console.log("estimatedDuration:", booking.estimated_duration);
      console.log("calculatedActualEnd:", actualEnd.toISOString());
      console.log("trigger:", "LATE_SCAN");
      console.log("=====================================\n");

      logger.info(
        `[LATE_SCAN] booking=${booking.id} actualStart=${now.toISOString()} actualEnd=${actualEnd.toISOString()}`
      );

      await QueueRecalculationService.smartRebuildFromBooking(
        booking.id,
        booking.staff_id,
        booking.service_date,
        actualEnd,
      ).catch(err => {
        console.error("[LATE_SCAN] smartRebuildFromBooking FAILED", err);
        logger.error("[LATE_SCAN] smartRebuildFromBooking FAILED:", err?.message);
      });

      const newArrivalStart = addMinutes(now, -15);
      const newScanEnd      = addMinutes(now, 10);

      emitToUser(booking.customer.user.id, "booking:time_updated", {
        bookingId,
        newServiceStartTime: toTZ(now),
        newArrivalStart:     toTZ(newArrivalStart),
        newArrivalEnd:       toTZ(now),
        newScanWindowEnd:    toTZ(newScanEnd),
        message:             `Service started at ${toISTTime(now)} (${delayMinutes}min late).`,
      });

      emitToBusiness(staff.business_id, "booking:time_updated", {
        bookingId,
        newServiceStartTime: toTZ(now),
        newArrivalStart:     toTZ(newArrivalStart),
        newArrivalEnd:       toTZ(now),
        newScanWindowEnd:    toTZ(newScanEnd),
      });
    }

    // ── Notify customer that service is RUNNING ────────────────────
    emitToUser(booking.customer.user.id, "booking:updated", {
      bookingId,
      status:             "RUNNING",
      service_started_at: now.toISOString(),
    });

    emitToBusiness(staff.business_id, "queue:updated", { staffId: staff.id });

    // FIX: jobId "service-started-${id}" — no colons
    await notificationQueue.add(
      `service-started-${bookingId}`,
      { bookingId, type: "service:started" },
      { jobId: `service-started-${bookingId}` },
    ).catch(() => {});

    await invalidateSlotCache(staff.id, booking.service_date.toISOString().slice(0, 10)).catch(() => {});

    logger.info(`[SCAN] ${bookingId} → RUNNING (late=${isLate}, delay=${delayMinutes}min, method=${scanMethod})`);

    return {
      bookingId,
      status:       "RUNNING",
      startedAt:    now.toISOString(),
      customerName: booking.customer.name,
      isLate,
      delayMinutes,
      services: Array.isArray(booking.services)
        ? booking.services.map((s: any) => s.name ?? "")
        : [],
    };
  }

  static async completeBooking(userId: string, bookingId: string) {
    const staff = await resolveStaff(userId);
    const now   = new Date();

    const booking = await prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        customer: { select: { id: true, name: true, user: { select: { id: true, email: true } } } },
        business: { select: { id: true, business_name: true } },
        payment:  { select: { id: true, status: true } },
      },
    });

    if (!booking)                      throw new NotFoundError("Booking not found.");
    if (booking.staff_id !== staff.id) throw new ForbiddenError("This booking is not assigned to you.");

    if (!booking.service_started_at) {
      throw new BadRequestError("Service has not been started yet. Scan the customer's QR code first.");
    }

    if (booking.status === "COMPLETED") {
      return { booking_id: bookingId, status: "COMPLETED", message: "Booking is already completed." };
    }

    if (!ALLOWED_TRANSITIONS[booking.status]?.includes("COMPLETED")) {
      throw new BadRequestError(`Cannot complete booking with status: ${booking.status}.`);
    }

    const staffTakenTime = differenceInMinutes(now, booking.service_started_at);

    await prisma.booking.update({
      where: { id: bookingId },
      data:  {
        status:               "COMPLETED",
        service_completed_at: now,
        staff_taken_time:     staffTakenTime,
        actual_duration:      staffTakenTime,
      },
    });

    logger.info(`[Complete] ${bookingId} → COMPLETED in ${staffTakenTime}min`);

    const { QueueRecalculationService } = await import("../queue/queue-recalculation.service");

    const scheduledEnd  = addMinutes(new Date(booking.service_start_time), booking.estimated_duration);
    const isEarlyFinish = now < scheduledEnd;

    if (isEarlyFinish) {
      await QueueRecalculationService.handleEarlyFinish(staff.id, booking.service_date).catch(() => {});
    } else {
      await QueueRecalculationService.rebuildQueue(staff.id, booking.service_date).catch(() => {});
      await QueueRecalculationService.autoMoveNextToRunning(staff.id, booking.service_date, true).catch(() => {});
    }
    const ts = Date.now();
    if (booking.payment?.status === "PAID") {
      logger.info(`[COMPLETE] enqueue settlement for ${bookingId}`);
      
      // FIX: jobId "settle-complete-${id}-${ts}" — no colons
      settleQueue.add(
        `settle-complete-${bookingId}-${ts}`,
        { bookingId },
        {
          delay:            0,
          jobId:            `settle-complete-${bookingId}-${ts}`,
          attempts:         5,
          removeOnComplete: true,
          removeOnFail:     1000,
        },
      ).catch(() => {});
    }

    // FIX: jobId "booking-completed-${id}-${ts}" — no colons
    await notificationQueue.add(
      `booking-completed-${bookingId}`,
      { bookingId, type: "booking:completed" },
      { jobId: `booking-completed-${bookingId}-${ts}` },
    ).catch(err => logger.error(`[Complete] notif enqueue FAILED for ${bookingId}:`, err?.message));

    // FIX: jobId "analytics-booking-completed-${id}-${ts}" — no colons
    analyticsQueue.add(
      `analytics-booking-completed-${bookingId}`,
      { type: "booking:completed", bookingId, staffId: staff.id, businessId: booking.business_id },
      { jobId: `analytics-booking-completed-${bookingId}-${ts}` },
    ).catch(() => {});

    emitToUser(booking.customer.user.id, "booking:updated", { bookingId, status: "COMPLETED" });
    emitToBusiness(booking.business_id, "queue:updated", { staffId: staff.id });

    logger.info(`[StaffBookingActions] ${bookingId} COMPLETED — taken=${staffTakenTime}min, early=${isEarlyFinish}`);

    return { bookingId, status: "COMPLETED", message: "Booking completed successfully." };
  }

  // ─────────────────────────────────────────────────────────────────
  // getPerformanceSummary — unchanged
  // ─────────────────────────────────────────────────────────────────
  static async getPerformanceSummary(userId: string, period: "week" | "month" | "year") {
    const staff = await resolveStaff(userId);
    const since = period === "week"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : period === "month"
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        : new Date(new Date().getFullYear(), 0, 1);

    const result = await prisma.booking.aggregate({
      where: {
        staff_id:         staff.id,
        status:           "COMPLETED",
        service_date:     { gte: since },
        staff_taken_time: { not: null },
      },
      _avg:   { estimated_duration: true, staff_taken_time: true },
      _count: { id: true },
      _sum:   { staff_taken_time: true, estimated_duration: true },
    });

    const avgExpected = result._avg.estimated_duration ?? 0;
    const avgActual   = result._avg.staff_taken_time   ?? 0;
    const sumActual   = result._sum.staff_taken_time   ?? 0;
    const sumEstimate = result._sum.estimated_duration ?? 0;

    return {
      total_bookings:                 result._count.id,
      completed:                      result._count.id,
      accuracy_percent:               avgExpected > 0 ? Math.min(100, Math.round((avgExpected / (avgActual || 1)) * 100)) : 100,
      avg_estimated_minutes:          Math.round(avgExpected),
      avg_actual_minutes:             Math.round(avgActual),
      extra_time_taken_total_minutes: Math.max(0, sumActual - sumEstimate),
    };
  }
}
