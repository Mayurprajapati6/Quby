import { Queue, QueueOptions } from "bullmq";
import { redisClient } from "./redis";
import logger from "./logger.config";

const connection = redisClient;

const defaultJobOptions: QueueOptions["defaultJobOptions"] = {
  attempts: 3,
  backoff:  { type: "exponential", delay: 2_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail:     { count: 5_000 },
};

export const QUEUE_NAMES = {
  EMAIL:        "email-queue",
  SETTLE:       "payment-settle",   
  REFUND:       "payment-refund",   
  NOTIFICATION: "notification-queue",
  BOOKING:      "booking-jobs",
  ANALYTICS:    "analytics-queue",
  DEAD_LETTER:  "dead-letter",
} as const;

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions,
});

export const settleQueue = new Queue(QUEUE_NAMES.SETTLE, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts:         5,
    removeOnComplete: { count: 10_000, age: 90 * 24 * 3600 }, 
    removeOnFail:     { count: 10_000, age: 90 * 24 * 3600 },
  },
});

export const refundQueue = new Queue(QUEUE_NAMES.REFUND, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts:         5,
    removeOnComplete: { count: 5_000, age: 90 * 24 * 3600 },
    removeOnFail:     { count: 5_000, age: 90 * 24 * 3600 },
  },
});

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
});

export const bookingQueue = new Queue(QUEUE_NAMES.BOOKING, {
  connection,
  defaultJobOptions,
});

export const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts:         2,
    removeOnComplete: { count: 500 },
  },
});

export const deadLetterQueue = new Queue(QUEUE_NAMES.DEAD_LETTER, {
  connection,
  defaultJobOptions: { attempts: 1, removeOnFail: { count: 10_000 } },
});

export type EmailJobType =
  | "staff-invitation"
  | "staff-reinvitation"
  | "password-reset"
  | "change-password-confirmation"
  | "booking-confirmation"
  | "booking-cancelled"
  | "booking-cancelled-by-business"
  | "refund-confirmation"
  | "leave-request-owner"
  | "leave-approved-staff"
  | "leave-rejected-staff"
  | "business-holiday"
  | "booking-reminder"
  | "account-deleted"
  | "service-completed";

export interface EmailJobPayload {
  to:   string;
  type: EmailJobType;
  data: Record<string, unknown>;
}

export interface SettleJobPayload {
  bookingId: string;
}

export interface RefundJobPayload {
  bookingId: string;
  paymentId: string;
  amount:    number;
  reason:    string;
}

export interface NotificationJobPayload {
  bookingId?: string;
  type?:      string;
}

export interface BookingJobPayload {
  bookingId: string;
  event:     "payment-timeout" | "no-show";
}

export type AnalyticsJobType =
  | "booking-created"
  | "booking-completed"
  | "booking-cancelled"
  | "payment-received"
  | "payment-settled"
  | "review-submitted";

export interface AnalyticsJobPayload {
  type:       AnalyticsJobType;
  bookingId?: string;
  businessId?: string;
  staffId?:   string;
  amount?:    number;
  metadata?:  Record<string, unknown>;
}

export async function getQueueStats() {
  const queues = [
    emailQueue, settleQueue, refundQueue,
    notificationQueue, bookingQueue, analyticsQueue, deadLetterQueue,
  ];
  return Promise.all(
    queues.map(async (q) => ({
      name:      q.name,
      waiting:   await q.getWaitingCount(),
      active:    await q.getActiveCount(),
      delayed:   await q.getDelayedCount(),
      failed:    await q.getFailedCount(),
      completed: await q.getCompletedCount(),
    })),
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    emailQueue.close(),
    settleQueue.close(),
    refundQueue.close(),
    notificationQueue.close(),
    bookingQueue.close(),
    analyticsQueue.close(),
    deadLetterQueue.close(),
  ]);
  logger.info("[BullMQ] All queues closed.");
}
