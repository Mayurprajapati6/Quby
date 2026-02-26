import { Queue, QueueOptions } from 'bullmq';
import { redisClient } from './redis';
import logger from './logger.config';

const connection = redisClient;

const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: {
    type:  'exponential',
    delay: 2_000,           
  },
  removeOnComplete: { count: 1_000 },  
  removeOnFail:     { count: 5_000 },  
};

export const QUEUE_NAMES = {
  EMAIL:        'email-queue',
  ESCROW:       'escrow-release',
  NOTIFICATION: 'notification-queue',
  BOOKING:      'booking-jobs',
  DEAD_LETTER:  'dead-letter',         
} as const;

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions,
});

export const escrowQueue = new Queue(QUEUE_NAMES.ESCROW, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5,  
  },
});

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,   
  },
});

export const bookingQueue = new Queue(QUEUE_NAMES.BOOKING, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
  },
});

export const deadLetterQueue = new Queue(QUEUE_NAMES.DEAD_LETTER, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 500 },
  },
});

export interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string | undefined;
  jobName:       string;
  jobData:       unknown;
  error:         string;
  attemptsMade:  number;
  failedAt:      string;
}

export type EmailJobType =
  | 'booking-confirmation'
  | 'staff-invitation'
  | 'password-reset'
  | 'refund-confirmation'
  | 'review-reminder'
  | 'leave-request-owner'
  | 'leave-approved-staff'
  | 'leave-rejected-staff'
  | 'business-approved'
  | 'business-rejected';

export type EscrowJobType    = 'release-escrow';
export type NotificationJobType = 'send-reminder' | 'review-reminder';
export type BookingJobType   = 'check-no-show';

export async function getQueueStats() {
  const queues = [emailQueue, escrowQueue, notificationQueue, bookingQueue, deadLetterQueue];
  const stats = await Promise.all(
    queues.map(async (q) => ({
      name:      q.name,
      waiting:   await q.getWaitingCount(),
      active:    await q.getActiveCount(),
      delayed:   await q.getDelayedCount(),
      failed:    await q.getFailedCount(),
      completed: await q.getCompletedCount(),
    }))
  );
  return stats;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    emailQueue.close(),
    escrowQueue.close(),
    notificationQueue.close(),
    bookingQueue.close(),
    deadLetterQueue.close(),
  ]);
  logger.info('[BullMQ] All queues closed');
}