import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { QUEUE_NAMES, deadLetterQueue, DeadLetterJobData } from '../config/bullmq';
import { prisma } from '../config/prisma';
import logger from '../config/logger.config';

interface NoShowJobData {
    bookingId: string;
}

export const bookingWorker = new Worker<NoShowJobData>(
    QUEUE_NAMES.BOOKING,
    async (job: Job<NoShowJobData>) => {
        logger.info(`[Booking Worker] Processing job ${job.id} (${job.name})`);

        switch (job.name) {

            case 'check-no-show': {
                const { bookingId } = job.data;

                const booking = await prisma.booking.findUnique({
                    where:   { id: bookingId },
                    include: {
                        customer: true,
                        staff:    true,
                        business: true,
                        escrow:   true,
                    },
                });

                if (!booking) {
                    logger.warn(`[Booking Worker] Booking not found: ${bookingId}`);
                    return { status: 'not_found' };
                }

                if (booking.status !== 'CONFIRMED') {
                    logger.info(`[Booking Worker] Booking ${bookingId} is ${booking.status} — skipping no-show check`);
                    return { status: 'skipped', bookingStatus: booking.status };
                }

                if (booking.checked_in_at) {
                    logger.info(`[Booking Worker] Customer checked in — skipping no-show: ${bookingId}`);
                    return { status: 'skipped', reason: 'already_checked_in' };
                }

                logger.info(`[Booking Worker] Marking NO_SHOW for booking ${bookingId}`);

                await prisma.$transaction(async (tx) => {
                    await tx.booking.update({
                        where: { id: bookingId },
                        data: {
                            status:              'CANCELLED_NO_SHOW',
                            cancelled_at:        new Date(),
                            cancellation_reason: 'Customer did not arrive within the arrival window', 
                        },
                    });
          
                    await tx.customer.update({
                        where: { id: booking.customer_id },
                        data: {
                            cancelled_bookings: { increment: 1 }, 
                            current_streak:     0,
                        },
                    });
          
                    await tx.bookingEvent.create({
                        data: {
                            booking_id: bookingId,
                            event_type: 'BOOKING_NO_SHOW',           
                            event_data: {
                                marked_at:          new Date().toISOString(),
                                arrival_window_end: booking.arrival_window_end,
                            },
                        },
                    });

                    await tx.customerNotification.create({
                        data: {
                            customer_id: booking.customer_id,
                            type:        'BOOKING_CANCELLED',
                            title:       'Booking Marked as No-Show',
                            message:     `Your booking at ${booking.business.business_name} was marked as no-show`, 
                            data: {
                                bookingId,
                                bookingNumber: booking.booking_number,
                            },
                        },
                    });

                    await tx.staffNotification.create({
                        data: {
                            staff_id: booking.staff_id,
                            type:     'BOOKING_CANCELLED',            // ← StaffNotificationType has BOOKING_CANCELLED not BOOKING_NO_SHOW
                            title:    'Customer No-Show',
                            message:  `Customer ${booking.customer.name} did not arrive for their appointment`,
                            data: {
                                bookingId,
                                customerName:  booking.customer.name,
                                bookingNumber: booking.booking_number,
                            },
                        },
                    });
                });
        
                try {
                    await redisClient.del(`cache:customer:${booking.customer_id}:bookings`);
                    await redisClient.del(`queue:staff:${booking.staff_id}:${booking.service_date}`);
                    await redisClient.del(`cache:staff:${booking.staff_id}:dashboard`);
                } catch (cacheErr) {
                    logger.warn('[Booking Worker] Cache invalidation failed (non-fatal):', cacheErr);
                }

                return { status: 'no_show_marked', bookingId };
            }

            default:
            logger.warn(`[Booking Worker] Unknown job type: ${job.name}`);
            return { status: 'unknown_job' };
        }
    },
    {
        connection:  redisClient,
        concurrency: 20,
    }
);


bookingWorker.on('completed', (job) => {
    logger.info(`[Booking Worker] Job ${job.id} completed`);
});

bookingWorker.on('failed', async (job, err) => {
    logger.error(`[Booking Worker] Job ${job?.id} failed: ${err.message}`);

  
    if (job && job.attemptsMade >= (job.opts.attempts ?? 2)) {
        logger.error(`[Booking Worker] All retries exhausted for job ${job.id} — routing to DLQ`);

        try {
            const dlqPayload: DeadLetterJobData = {
                originalQueue: QUEUE_NAMES.BOOKING,
                originalJobId: job.id,
                jobName:       job.name,
                jobData:       job.data,
                error:         err.message,
                attemptsMade:  job.attemptsMade,
                failedAt:      new Date().toISOString(),
            };
            await deadLetterQueue.add('dead-booking', dlqPayload);
            logger.info(`[Booking Worker] Job ${job.id} moved to DLQ`);
        } catch (dlqErr) {
            logger.error('[Booking Worker] Failed to push to DLQ:', dlqErr);
        }
    }
});

bookingWorker.on('error', (err) => {
    logger.error('[Booking Worker] Worker error:', err.message);
});

export default bookingWorker;