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

export const refundWorker = new Worker<RefundJobData>(
  QUEUE_NAMES.REFUND,
  async (job: Job<RefundJobData>) => {
    const { bookingId, paymentId, amount, reason } = job.data;
    logger.info(`[RefundWorker] Processing refund for booking ${bookingId}`);

    const payment = await prisma.payment.findUnique({
      where:  { booking_id: bookingId },
      select: { refund_status: true, status: true },
    });

    if (!payment) {
      logger.warn(`[RefundWorker] Payment not found for booking ${bookingId}`);
      return { status: "not_found" };
    }

    if (payment.refund_status === "DONE") {
      logger.info(`[RefundWorker] Refund already done for booking ${bookingId}`);
      return { status: "already_done" };
    }

let refund: any;
try {
  refund = await razorpay.payments.refund(paymentId, {
    amount,
    notes: { booking_id: bookingId, reason },
  });
} catch (razorpayErr: any) {
  const desc = razorpayErr?.error?.description
    ?? razorpayErr?.message
    ?? JSON.stringify(razorpayErr);
  logger.error(`[RefundWorker] Razorpay API error: ${desc}`, {
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
          refund_amount: amount,
        },
      }),
      
      prisma.bookingEvent.create({
        data: {
          booking_id: bookingId,
          event_type: "REFUND_INITIATED",
          event_data: { refund_id: refund.id, amount, reason },
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
        refund_amount: payment.amount,   
  refunded_at: new Date(),
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