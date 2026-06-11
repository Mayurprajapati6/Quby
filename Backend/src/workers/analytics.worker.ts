
import { Worker, Job } from "bullmq";
import { redisClient } from "../config/redis";
import { QUEUE_NAMES } from "../config/bullmq";
import { prisma } from "../config/prisma";
import logger from "../config/logger.config";

interface AnalyticsJobData {
  type:       string;
  bookingId?: string;
  businessId?: string;
  staffId?:   string;
}

export const analyticsWorker = new Worker<AnalyticsJobData>(
  QUEUE_NAMES.ANALYTICS,
  async (job: Job<AnalyticsJobData>) => {
    const { type, bookingId } = job.data;

    switch (type) {
      case "booking-created":
        await handleBookingCreated(bookingId!);
        break;
      case "booking-completed":
        await handleBookingCompleted(bookingId!);
        break;
      case "booking-cancelled":
        await handleBookingCancelled(bookingId!);
        break;
      case "payment-received":
      case "payment-settled":
        logger.info(`[Analytics] ${type} for booking ${bookingId}`);
        break;
      default:
        logger.warn(`[Analytics] Unknown job type: ${type}`);
    }
  },
  { connection: redisClient, concurrency: 5 },
);

async function handleBookingCreated(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { customer_id: true, service_amount: true, service_date: true },
  });
  if (!booking) return;
  
  await prisma.customer.update({
    where: { id: booking.customer_id },
    data:  { total_bookings: { increment: 1 } },
  }).catch(() => {});
}

async function handleBookingCompleted(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { customer_id: true, service_amount: true, service_date: true },
  });
  if (!booking) return;

  await prisma.customer.update({
    where: { id: booking.customer_id },
    data:  {
      completed_bookings: { increment: 1 },
      total_spent:        { increment: booking.service_amount },
      last_booking_date:  new Date(),
    },
  }).catch(() => {});
}

async function handleBookingCancelled(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { customer_id: true },
  });
  if (!booking) return;

  await prisma.customer.update({
    where: { id: booking.customer_id },
    data:  { cancelled_bookings: { increment: 1 } },
  }).catch(() => {});
}

analyticsWorker.on("failed", (job, err) => {
  logger.error(`[Analytics] Job ${job?.id} failed: ${err.message}`);
});
analyticsWorker.on("error", (err) => {
  logger.error("[Analytics] Worker error:", err.message);
});
