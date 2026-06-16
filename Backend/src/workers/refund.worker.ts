import { Worker, Job } from "bullmq";
import { redisClient } from "../config/redis";
import { QUEUE_NAMES, notificationQueue } from "../config/bullmq";
import { prisma } from "../config/prisma";
import { razorpay } from "../config/razorpay";
import logger from "../config/logger.config";
import { emitToUser } from "../socket/socket.service";
import { queueEmail } from "../services/email.services";

interface RefundJobData {
  bookingId: string;
  paymentId: string;
  amount:    number;
  reason:    string;
}

function safeRefundReceipt(bookingId: string): string {
  return `rfnd_${bookingId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

function readRazorpayAmount(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : null;
}

export const refundWorker = new Worker<RefundJobData>(
  QUEUE_NAMES.REFUND,
  async (job: Job<RefundJobData>) => {
    const { bookingId, paymentId, amount, reason } = job.data;
    logger.info(`[RefundWorker] Processing refund for booking ${bookingId}`);

    const payment = await prisma.payment.findUnique({
      where:  { booking_id: bookingId },
      select: {
        id:                  true,
        amount:              true,
        refund_id:           true,
        refund_status:       true,
        refund_amount:       true,
        status:              true,
        razorpay_payment_id: true,
      },
    });

    if (!payment) {
      logger.warn(`[RefundWorker] Payment not found for booking ${bookingId}`);
      return { status: "not_found" };
    }

    if (payment.refund_status === "DONE") {
      logger.info(`[RefundWorker] Refund already done for booking ${bookingId}`);
      return { status: "already_done" };
    }

    const razorpayPaymentId = payment.razorpay_payment_id ?? paymentId;
    if (!razorpayPaymentId) {
      throw new Error(`Missing Razorpay payment id for booking ${bookingId}`);
    }

    if (paymentId && payment.razorpay_payment_id && paymentId !== payment.razorpay_payment_id) {
      logger.warn(`[RefundWorker] Job paymentId mismatch for ${bookingId}; using database payment id`);
    }

    let refund: any;
    let refundAmount = readRazorpayAmount(amount) ?? readRazorpayAmount(payment.refund_amount) ?? payment.amount;

    try {
      const remotePayment: any = await razorpay.payments.fetch(razorpayPaymentId);
      const capturedAmount = readRazorpayAmount(remotePayment?.amount);
      const alreadyRefunded = readRazorpayAmount(remotePayment?.amount_refunded) ?? 0;

      if (capturedAmount) {
        const refundableAmount = Math.max(0, capturedAmount - alreadyRefunded);

        if (refundableAmount <= 0) {
          await prisma.$transaction([
            prisma.booking.update({
              where: { id: bookingId },
              data:  { status: "REFUNDED" },
            }),
            prisma.payment.update({
              where: { id: payment.id },
              data:  {
                status:        "REFUNDED",
                refund_status: "DONE",
                refund_amount: payment.refund_amount ?? capturedAmount,
                refunded_at:   new Date(),
              },
            }),
            prisma.bookingEvent.create({
              data: {
                booking_id: bookingId,
                event_type: "REFUND_COMPLETED",
                event_data: {
                  amount: payment.refund_amount ?? capturedAmount,
                  source: "razorpay_already_refunded",
                },
              },
            }),
          ]);
          logger.info(`[RefundWorker] Payment ${razorpayPaymentId} already fully refunded`);
          return { status: "already_refunded" };
        }

        refundAmount = Math.min(refundAmount, refundableAmount);
      }

      refund = await razorpay.payments.refund(razorpayPaymentId, {
        amount: refundAmount,
        receipt: safeRefundReceipt(bookingId),
        notes: { booking_id: bookingId, reason: String(reason ?? "Booking cancellation").slice(0, 240) },
      });
    } catch (razorpayErr: any) {
      const desc = razorpayErr?.error?.description
        ?? razorpayErr?.message
        ?? JSON.stringify(razorpayErr);
      logger.error(`[RefundWorker] Razorpay API error: ${desc}`, {
        bookingId,
        paymentId: razorpayPaymentId,
        amount:    refundAmount,
        statusCode: razorpayErr?.statusCode,
        code:       razorpayErr?.error?.code,
        raw:        razorpayErr,
      });
      throw new Error(desc);
    }

    await prisma.$transaction([
      
      prisma.booking.update({
        where: { id: bookingId },
        data:  { status: "REFUND_INITIATED" },
      }),
      
      prisma.payment.update({
        where: { booking_id: bookingId },
        data:  {
          refund_id:     refund.id,
          refund_status: "PROCESSING",
          refund_amount: refundAmount,
        },
      }),
      
      prisma.bookingEvent.create({
        data: {
          booking_id: bookingId,
          event_type: "REFUND_INITIATED",
          event_data: { refund_id: refund.id, amount: refundAmount, reason },
        },
      }),
    ]);

    const safeId = bookingId.replace(/:/g, "-");
    await notificationQueue.add(
      `refund-initiated-${safeId}`,
      { type: "refund-initiated", bookingId },
      { jobId: `refund-initiated-${safeId}` },
    );

    logger.info(`[RefundWorker] ✅ Refund initiated: ${refund.id} for booking ${bookingId}`);
    return { status: "initiated", refundId: refund.id };
  },
  { connection: redisClient, concurrency: 5 },
);

refundWorker.on("failed", async (job, err) => {
  logger.error(`[RefundWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message ?? JSON.stringify(err)}`);

  if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
    logger.error("[RefundWorker] CRITICAL: All retries exhausted — MANUAL ACTION REQUIRED", {
      bookingId: job.data.bookingId,
      paymentId: job.data.paymentId,
      amount:    job.data.amount,
      error:     err.message,
    });

    await prisma.payment.update({
      where: { booking_id: job.data.bookingId },
      data:  { refund_status: "FAILED" },
    }).catch(() => {});
  }
});

refundWorker.on("error", (err) => {
  logger.error("[RefundWorker] Worker error:", err.message);
});

export async function handleRefundWebhookConfirmed(
  razorpayPaymentId: string,
  refundId: string,
  refundAmount?: number,
): Promise<void> {

  const payment = await prisma.payment.findFirst({
    where: { razorpay_payment_id: razorpayPaymentId },
  });

  if (!payment) {
    logger.warn(`[RefundWorker] Webhook: no payment found for payment ${razorpayPaymentId}`);
    return;
  }

  if (payment.refund_status === "DONE") {
    logger.info(`[RefundWorker] Webhook: refund already done for payment ${razorpayPaymentId}`);
    return;
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: payment.booking_id },
      data: { status: "REFUNDED" },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        refund_status: "DONE",
        refund_id: refundId,
        status: "REFUNDED",
        refund_amount: refundAmount ?? payment.refund_amount ?? payment.amount,
        refunded_at: new Date(),
      },
    }),
    prisma.bookingEvent.create({
      data: {
        booking_id: payment.booking_id,
        event_type: "REFUND_COMPLETED",
        event_data: { refund_id: refundId, amount: refundAmount ?? payment.refund_amount ?? payment.amount },
      },
    }),
  ]);

  const bookingId = payment.booking_id;
  const safeId = bookingId.replace(/:/g, "-");

  await notificationQueue.add(
    `refund-completed-${safeId}`,
    { type: "refund-completed", bookingId },
    { jobId: `refund-completed-${safeId}` }
  );

  logger.info(`[RefundWorker] Webhook: REFUNDED for booking ${payment.booking_id}`);

  const bookingFull = await prisma.booking.findUnique({
    where:   { id: payment.booking_id },
    select:  {
      booking_number: true,
      customer: { select: { name: true, user: { select: { id: true, email: true } } } },
      business: { select: { business_name: true } },
    },
  });

  if (bookingFull) {
    queueEmail({
      to:   bookingFull.customer.user.email,
      type: "refund-confirmation",
      data: {
        customerName:  bookingFull.customer.name,
        businessName:  bookingFull.business.business_name,
        bookingNumber: bookingFull.booking_number,
        refundAmount:  payment.refund_amount ?? payment.amount,
      },
    }).catch(err => logger.warn(`[RefundWorker] Email failed ${payment.booking_id}:`, err?.message));
  }

const bookingWithCustomer = await prisma.booking.findUnique({
  where: { id: payment.booking_id },
  select: { customer: { select: { user: { select: { id: true } } } } },
});
if (bookingWithCustomer?.customer?.user?.id) {
  emitToUser(bookingWithCustomer.customer.user.id, 'booking:updated', {
    bookingId: payment.booking_id,
    status: 'REFUNDED',
  });
}
}

export async function handleRefundWebhookCreated(
  razorpayPaymentId: string,
  refundId: string,
  refundAmount?: number,
): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { razorpay_payment_id: razorpayPaymentId },
  });

  if (!payment || payment.refund_status === "DONE") return;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: payment.booking_id },
      data:  { status: "REFUND_INITIATED" },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data:  {
        refund_id:     refundId,
        refund_status: "PROCESSING",
        refund_amount: refundAmount ?? payment.refund_amount ?? payment.amount,
      },
    }),
    prisma.bookingEvent.create({
      data: {
        booking_id: payment.booking_id,
        event_type: "REFUND_INITIATED",
        event_data: { refund_id: refundId, amount: refundAmount ?? payment.refund_amount ?? payment.amount },
      },
    }),
  ]);
}
