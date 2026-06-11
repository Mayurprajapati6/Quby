/**
 * workers/booking.worker.ts
 *
 * CHANGES FROM YOUR ORIGINAL:
 * 1. Added import for emitToUser and invalidateSlotCache
 * 2. Added import for formatInTimeZone
 * 3. handlePaymentTimeout: fetch booking BEFORE updating (need staff_id, service_date, customer userId)
 * 4. handlePaymentTimeout: after expiring → invalidateSlotCache() so gap-fill reclaims the slot
 * 5. handlePaymentTimeout: after expiring → emitToUser('booking:expired') so step-4 UI resets immediately
 *
 * NO-SHOW is intentionally NOT here — you handle it in another file.
 * Everything else is identical to your original.
 */

import { Worker, Job }         from "bullmq";
import { redisClient }         from "../config/redis";
import { QUEUE_NAMES }         from "../config/bullmq";
import { prisma }              from "../config/prisma";
import { emitToUser }          from "../socket/socket.service";        // ← ADDED
import { invalidateSlotCache } from "../utils/cache/slotCache";        // ← ADDED
import { formatInTimeZone }    from "date-fns-tz";                     // ← ADDED
import logger                  from "../config/logger.config";

const TZ = "Asia/Kolkata";

interface BookingJobData {
  bookingId: string;
  event:     "payment-timeout";
}

export const bookingWorker = new Worker<BookingJobData>(
  QUEUE_NAMES.BOOKING,
  async (job: Job<BookingJobData>) => {
    const { bookingId, event } = job.data;
    logger.info(`[BookingWorker] job=${job.id} event=${event} bookingId=${bookingId}`);

    if (event === "payment-timeout") {
      await handlePaymentTimeout(bookingId);
    }
  },
  { connection: redisClient, concurrency: 10 },
);

async function handlePaymentTimeout(bookingId: string): Promise<void> {
  try {
    // ── ADDED: Fetch BEFORE updating so we have staff_id, service_date, customer userId
    // These are needed for cache invalidation and socket emission below.
    const bookingBefore = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: {
        status:            true,
        staff_id:          true,
        service_date:      true,
        reservation_token: true,
        customer: {
          select: { user: { select: { id: true } } },
        },
      },
    });

    // Step 1 — expire ONLY if still pending (atomic) — YOUR ORIGINAL LOGIC UNCHANGED
    const result = await prisma.booking.updateMany({
      where: {
        id:     bookingId,
        status: "PENDING_PAYMENT",
      },
      data: {
        status:              "EXPIRED",
        cancelled_by:        "SYSTEM",
        cancellation_reason: "PAYMENT_TIMEOUT",
        cancelled_at:        new Date(),
        is_visible:          false,
      },
    });

    // Step 2 — clean reservation token — YOUR ORIGINAL LOGIC UNCHANGED
    if (bookingBefore?.reservation_token) {
      await redisClient
        .del(`reservation:${bookingBefore.reservation_token}`)
        .catch(() => {});
    }

    // Already processed → exit safely — YOUR ORIGINAL LOGIC UNCHANGED
    if (result.count === 0) {
      logger.info(
        `[BookingWorker] payment-timeout: booking ${bookingId} already handled — skip`,
      );
      return;
    }

    // Step 3 — safety correction edge case — YOUR ORIGINAL LOGIC UNCHANGED
    await prisma.booking.updateMany({
      where: {
        id:     bookingId,
        status: "CANCELLED",
        payment: { status: "PENDING" },
      },
      data: {
        status:       "EXPIRED",
        is_visible:   false,
        cancelled_by: "SYSTEM",
      },
    });

    // Step 4 — audit log — YOUR ORIGINAL LOGIC UNCHANGED
    await prisma.bookingEvent
      .create({
        data: {
          booking_id: bookingId,
          event_type: "PAYMENT_TIMEOUT",
          event_data: { reason: "payment window expired" },
        },
      })
      .catch(() => {});

    // ── ADDED: Invalidate slot cache ──────────────────────────────────────────
    // The PENDING_PAYMENT booking held a slot in the gap-fill algorithm.
    // Now it is EXPIRED, that slot is free. Invalidating the cache ensures
    // the next checkAvailability call sees the freed gap immediately.
    if (bookingBefore?.staff_id && bookingBefore?.service_date) {
      const dateStr = formatInTimeZone(
        new Date(bookingBefore.service_date),
        TZ,
        "yyyy-MM-dd",
      );
      invalidateSlotCache(bookingBefore.staff_id, dateStr).catch(() => {});
    }

    // ── ADDED: Emit booking:expired to customer's open tab ────────────────────
    // If the customer is on step 4 (payment page) with the tab open, BookingFlow
    // listens for this via useSocketEvent('booking:expired') and immediately:
    //   - Shows toast: "Your slot was released — payment window expired."
    //   - Resets UI to step 1 so they can re-book cleanly
    // If the tab is closed, they see EXPIRED status when they open My Bookings.
    const customerUserId = bookingBefore?.customer?.user?.id;
    if (customerUserId) {
      emitToUser(customerUserId, "booking:expired", {
        bookingId,
        message:
          "Your slot was released because payment was not completed in time. Please start over.",
      });
    }

    // ❌ NO push notifications — timeout is silent (your original decision, correct)
    // ❌ NO analytics — your original decision, correct

    logger.info(
      `[BookingWorker] PAYMENT_TIMEOUT: booking ${bookingId} expired, slot freed, socket emitted`,
    );
  } catch (err: any) {
    logger.error(
      `[BookingWorker] PAYMENT_TIMEOUT ERROR booking=${bookingId}`,
      err?.message,
    );
    throw err; // let BullMQ retry
  }
}

bookingWorker.on("failed", (job, err) => {
  logger.error(`[BookingWorker] Job ${job?.id} failed:`, err.message);
});
bookingWorker.on("error", (err) => {
  logger.error("[BookingWorker] Worker error:", err.message);
});