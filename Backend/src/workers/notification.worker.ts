import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { QUEUE_NAMES } from '../config/bullmq';
import { prisma } from '../config/prisma';
import { queueEmail } from '../../src/services/email.services';
import logger from '../config/logger.config';

interface ReminderJobData {
    bookingId:    string;
    reminderType: '1hr' | '15min';
}

interface ReviewReminderJobData {
    bookingId:  string;
    customerId: string;
}

type NotificationJobData = ReminderJobData | ReviewReminderJobData;


export const notificationWorker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<NotificationJobData>) => {
        logger.info(`[Notification Worker] Processing job ${job.id} (${job.name})`);

        switch (job.name) {

            case 'send-reminder': {
                const { bookingId, reminderType } = job.data as ReminderJobData;

                const booking = await prisma.booking.findUnique({
                    where:   { id: bookingId },
                    include: {
                        customer: {
                            include: { user: true },  
                        },
                        staff:    true,
                        business: true,
                    },
                });

                if (!booking) {
                    logger.warn(`[Notification Worker] Booking not found: ${bookingId}`);
                    return { status: 'booking_not_found' };
                }

        
                if (booking.status !== 'CONFIRMED') {
                    logger.info(`[Notification Worker] Booking ${bookingId} is ${booking.status} — skipping reminder`);
                    return { status: 'skipped', reason: booking.status };
                }

                const timeLabel        = reminderType === '1hr' ? '1 hour' : '15 minutes';
    
                const notificationType = reminderType === '1hr' ? 'REMINDER_1_HOUR' as const : 'REMINDER_15_MIN' as const;


                await prisma.customerNotification.create({
                    data: {
                        customer_id: booking.customer_id,
                        type:        notificationType,
                        title:       `Appointment in ${timeLabel}`,
                        message:     `Your appointment at ${booking.business.business_name} starts in ${timeLabel}`,
                        data: {
                            bookingId,
                            businessName: booking.business.business_name,
                            staffName:    booking.staff.name,            // name is on Staff model directly
                            arrivalTime:  booking.arrival_window_start,
                        },
                    },
                });

    
                await queueEmail({
                    to:   booking.customer.user.email,               // email is on User model
                    type: 'review-reminder',
                    data: {
                        customerName:  booking.customer.name,          // name is on Customer model directly
                        businessName:  booking.business.business_name,
                        staffName:     booking.staff.name,
                        arrivalTime:   booking.arrival_window_start,
                        bookingNumber: booking.booking_number,
                        timeLabel,
                    },
                });

                return { status: 'success', bookingId, reminderType };
            }

      
            case 'review-reminder': {
                const { bookingId, customerId } = job.data as ReviewReminderJobData;

                const booking = await prisma.booking.findUnique({
                    where:   { id: bookingId },
                    include: {
                        customer: {
                            include: { user: true },  
                        },
                        business: true,
                        staff:    true,
                        review:   true,
                    },
                });

                if (!booking) return { status: 'booking_not_found' };

                if (booking.review) {
                    logger.info(`[Notification Worker] Review already exists for booking ${bookingId}`);
                    return { status: 'already_reviewed' };
                }

        
                if (booking.status !== 'COMPLETED') {
                    logger.info(`[Notification Worker] Booking not completed — skipping review reminder`);
                    return { status: 'skipped' };
                }

        
                await prisma.customerNotification.create({
                    data: {
                        customer_id: customerId,
                        type:        'REVIEW_REQUEST',
                        title:       'How was your visit?',
                        message:     `Share your experience at ${booking.business.business_name}`,
                        data: {
                            bookingId,
                            businessName: booking.business.business_name,
                            staffName:    booking.staff.name,
                        },
                    },
                });

        
                await queueEmail({
                    to:   booking.customer.user.email,               // email is on User model
                    type: 'review-reminder',
                    data: {
                        customerName: booking.customer.name,           // name is on Customer model directly
                        businessName: booking.business.business_name,
                        staffName:    booking.staff.name,
                        bookingId,
                    },
                });

                return { status: 'success', bookingId };
            }

            default:
                logger.warn(`[Notification Worker] Unknown job type: ${job.name}`);
                return { status: 'unknown_job' };
        }
    },
    {
        connection:  redisClient,
        concurrency: 10,
    }
);

notificationWorker.on('completed', (job) => {
    logger.info(`[Notification Worker] Job ${job.id} (${job.name}) completed`);
});

notificationWorker.on('failed', (job, err) => {
    logger.error(`[Notification Worker] Job ${job?.id} failed: ${err.message}`);
});

notificationWorker.on('error', (err) => {
    logger.error('[Notification Worker] Worker error:', err.message);
});

export default notificationWorker;