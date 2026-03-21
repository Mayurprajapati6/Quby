import { Queue, QueueOptions } from "bullmq";
import { redisClient }         from "./redis";
import logger                  from "./logger.config";

const connection = redisClient;

const defaultJobOptions: QueueOptions["defaultJobOptions"] = {
  attempts: 3,
  backoff:  { type: "exponential", delay: 2_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail:     { count: 5_000 },
};

export const QUEUE_NAMES = {
  EMAIL:        "email-queue",
  ESCROW:       "escrow-release",
  NOTIFICATION: "notification-queue",
  BOOKING:      "booking-jobs",
  ANALYTICS:    "analytics-queue",
  DEAD_LETTER:  "dead-letter",
} as const;

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions,
});

export const escrowQueue = new Queue(QUEUE_NAMES.ESCROW, {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 5 },
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

  | "email-verification"
  | "password-reset"
  | "change-password-confirmation"
  | "account-deleted"

  | "account-suspended"
  | "account-unsuspended"

  | "staff-invitation"
  | "staff-reinvitation"
  | "business-credentials"

  | "booking-confirmation"
  | "booking-cancelled"
  | "booking-cancelled-by-business"
  | "booking-no-show"
  | "booking-reminder"
  | "refund-confirmation"

  | "service-completed"
  | "service-delayed"

  | "review-reminder"

  | "business-submitted"
  | "business-verified"
  | "business-rejected"

  | "business-suspended"
  | "business-unsuspended"

  | "leave-request-owner"
  | "leave-approved-staff"
  | "leave-rejected-staff"

  | "business-holiday";

export type EscrowJobType        = "release-escrow";
export type NotificationJobType  = "send-reminder" | "review-reminder" | "cleanup-notifications";
export type BookingJobType       = "check-no-show";

export interface EmailJobPayload {
  to:   string;
  type: EmailJobType;
  data: Record<string, unknown>;
}

export interface EscrowJobPayload {
  bookingId:    string;
  businessId:   string;
  escrowAmount: number;
}
export interface NotificationJobPayload {
  bookingId?: string;
  type?:      string;
}
export interface BookingJobPayload {
  bookingId: string;
}

export type AnalyticsJobType =
  | "booking-created"
  | "booking-completed"
  | "booking-cancelled"
  | "payment-received"
  | "review-submitted"
  | "escrow-released";

export interface AnalyticsJobPayload {
  type:       AnalyticsJobType;
  bookingId?: string;
  businessId?: string;
  staffId?:   string;
  amount?:    number;
  metadata?:  Record<string, unknown>;
}

export async function getQueueStats() {
  const queues = [emailQueue, escrowQueue, notificationQueue, bookingQueue, analyticsQueue, deadLetterQueue];
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
    escrowQueue.close(),
    notificationQueue.close(),
    bookingQueue.close(),
    analyticsQueue.close(),
    deadLetterQueue.close(),
  ]);
  logger.info("[BullMQ] All queues closed.");
}
