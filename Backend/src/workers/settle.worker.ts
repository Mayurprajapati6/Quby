import { Worker, Job } from "bullmq";
import { redisClient } from "../config/redis";
import { QUEUE_NAMES, analyticsQueue } from "../config/bullmq";
import { prisma } from "../config/prisma";
import { emitToUser } from "../socket/socket.service";
import logger from "../config/logger.config";

interface SettleJobData {
  bookingId: string;
}

export const settleWorker = new Worker<SettleJobData>(
  QUEUE_NAMES.SETTLE,
  async (job: Job<SettleJobData>) => {
    const { bookingId } = job.data;
    if (!bookingId) {
      logger.error(`[SettleWorker] Job ${job.id} has no bookingId — discarding`);
      return { status: "discarded", reason: "missing bookingId" };
    }

    logger.info(`[SettleWorker] Processing settlement for booking: ${bookingId}`);

    const payment = await prisma.payment.findUnique({
      where:   { booking_id: bookingId },
      include: {
        booking: {
          select: {
            id:             true,
            booking_number: true,
            status:         true,
            business_id:    true,
            business: {
              select: {
                business_name: true,
                owner: { select: { user: { select: { id: true } } } },
              },
            },
            customer: { select: { name: true } },
            staff:    { select: { name: true } },
          },
        },
      },
    });

    if (!payment) {
      logger.error(`[SettleWorker] Payment not found for booking ${bookingId}`);
      throw new Error(`Payment not found: ${bookingId}`);
    }

    if (payment.status !== "PAID") {
      logger.info(`[SettleWorker] Payment already ${payment.status} — skipping`);
      logger.warn(
  `[SettleWorker] SKIPPED ${bookingId} because payment.status=${payment.status}`
);
      return { status: "already_processed", paymentStatus: payment.status };
    }

    const { booking } = payment;
    if (!["COMPLETED", "NO_SHOW"].includes(booking.status)) {
      logger.info(`[SettleWorker] Booking '${booking.status}' not eligible for settlement`);

      if (["CANCELLED"].includes(booking.status)) {
        await prisma.payment.update({
          where: { id: payment.id },
          data:  { status: "REFUNDED" },
        });
        logger.warn(`[SettleWorker] Auto-marked payment as REFUNDED for cancelled booking ${bookingId}`);
      }

      return { status: "not_eligible", bookingStatus: booking.status };
    }

    const isNoShow = booking.status === "NO_SHOW";
    

    const now      = new Date();

    const settled = await prisma.payment.updateMany({
      where: { booking_id: bookingId, status: "PAID" },
      data:  { status: "SETTLED", settled_at: now },
    });

    logger.info(
  `[SettleWorker] updateMany result for ${bookingId}: count=${settled.count}`
);

    if (settled.count === 0) {
      logger.info(`[SettleWorker] Race lost — payment already updated for ${bookingId}`);
      return { status: "already_processed" };
    }
    

    await prisma.bookingEvent.create({
      data: {
        booking_id: bookingId,
        event_type: "PAYMENT_SETTLED",
        event_data: {
          amount:  payment.amount,
          reason:  isNoShow ? "no_show" : "service_completed",
        },
      },
    });

    const amountInr = (payment.amount / 100).toFixed(2);
    await prisma.businessNotification.create({
      data: {
        business_id: payment.business_id,
        type:        "PAYMENT_SETTLED",
        title: isNoShow 
          ? "Payment Settled — Customer No-Show" 
          : "Payment Settled",
        message: isNoShow
          ? `₹${amountInr} received from ${booking.customer.name} (no-show) for booking #${booking.booking_number} with ${booking.staff.name} at ${booking.business.business_name}.`
          : `₹${amountInr} received from ${booking.customer.name} for booking #${booking.booking_number} with ${booking.staff.name} at ${booking.business.business_name}.`,
        target:      "BOTH",
        expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        data: {
          bookingId,
          amount:       payment.amount,
          customerName: booking.customer.name,
          staffName:    booking.staff.name,
          reason:       isNoShow ? "no_show" : "service_completed",
        },
      },
    }).catch(() => {});

    try {
      const ownerUserId = booking.business.owner?.user?.id;
      if (ownerUserId) {
        emitToUser(ownerUserId, "payment:settled", {
          bookingId,
          bookingNumber: booking.booking_number,
          amount:        payment.amount,
          businessName:  booking.business.business_name,
        });
      }
    } catch (err) {
      logger.warn("[SettleWorker] Socket notification failed (non-fatal):", err);
    }

    logger.info(
      `[SettleWorker] ✅ Settled ₹${amountInr} for booking ${booking.booking_number} ` +
      `(${isNoShow ? "no-show" : "completed"})`,
    );

    return { status: "success", paymentId: payment.id, amount: payment.amount };
  },
  {
    connection:  redisClient,
    concurrency: 10,
    limiter:     { max: 100, duration: 1_000 },
  },
);

settleWorker.on("completed", (job, result) => {
  logger.info(`[SettleWorker] Job ${job.id} completed:`, result);

  const safeId = String(job.data.bookingId).replace(/:/g, '-')
  if (result?.status === "success" && job.data?.bookingId) {
    analyticsQueue.add(
      `payment-settled-${safeId}`,
  { type: "payment-settled", bookingId: job.data.bookingId },
  { jobId: `analytics-payment-settled-${safeId}` },
    ).catch(() => {});
  }
});

settleWorker.on("failed", (job, err) => {
  logger.error(`[SettleWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
    logger.error("[SettleWorker] CRITICAL: Settlement failed after all retries", {
      bookingId: job.data.bookingId,
      jobId:     job.id,
      error:     err.message,
    });
  }
});

settleWorker.on("error", (err) => {
  logger.error("[SettleWorker] Worker error:", err.message);
});
