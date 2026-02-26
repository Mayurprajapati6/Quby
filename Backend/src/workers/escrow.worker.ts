import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { QUEUE_NAMES, deadLetterQueue, DeadLetterJobData } from '../config/bullmq';
import { prisma } from '../config/prisma';
import logger from '../config/logger.config';

interface EscrowJobData {
  bookingId: string;
}

export const escrowWorker = new Worker<EscrowJobData>(
    QUEUE_NAMES.ESCROW,
    async (job: Job<EscrowJobData>) => {
        const { bookingId } = job.data;

        logger.info(`[Escrow Worker] Processing release for booking: ${bookingId}`);

        const escrow = await prisma.escrowTransaction.findUnique({
            where: { booking_id: bookingId },
            include: {
                booking: {
                    include: {
                        business: {
                            include: {
                                wallet: true,
                                owner:  true,
                            },
                        },
                        staff:    true,
                        customer: true,
                    },
                },
            },
        });

        if (!escrow) {
            logger.error(`[Escrow Worker] Escrow not found for booking ${bookingId}`);
            throw new Error(`Escrow not found: ${bookingId}`);
        }

        if (escrow.status !== 'HELD') {
            logger.info(`[Escrow Worker] Already ${escrow.status} — skipping: ${escrow.id}`);
            return { status: 'already_processed', escrowStatus: escrow.status };
        }

        const { booking } = escrow;

        if (!['COMPLETED', 'CANCELLED_NO_SHOW'].includes(booking.status)) {
            logger.info(
                `[Escrow Worker] Booking status '${booking.status}' not eligible for release — skipping`
            );

            if (['CANCELLED', 'CANCELLED_TIMEOUT'].includes(booking.status)) {
                await prisma.escrowTransaction.update({
                    where: { id: escrow.id },
                    data:  { status: 'REFUNDED', refunded_at: new Date() },
                });
                logger.warn(`[Escrow Worker] Auto-marked escrow as REFUNDED for cancelled booking ${bookingId}`);
            }

            return { status: 'not_eligible', bookingStatus: booking.status };
        }

        if (!booking.business.wallet) {
            logger.error(`[Escrow Worker] No wallet for business ${escrow.business_id}`);
            throw new Error(`Business wallet missing: ${escrow.business_id}`);
        }
    
        await prisma.$transaction(async (tx) => {
            const newBalance = booking.business.wallet!.balance + escrow.amount;

    
            await tx.businessWallet.update({
                where: { id: booking.business.wallet!.id },
                data: {
                    balance:           { increment: escrow.amount },
                    lifetime_earnings: { increment: escrow.amount },
                },
            });

            await tx.businessWalletTransaction.create({
                data: {
                    wallet_id:     booking.business.wallet!.id,
                    type:          'ESCROW_RELEASE',
                    amount:        escrow.amount,
                    balance_after: newBalance,
                    booking_id:    bookingId,
                    escrow_id:     escrow.id,
                    description:   `Escrow released for booking ${booking.booking_number}`,
                    metadata: {
                        customerName: booking.customer.name,
                        staffName:    booking.staff.name,
                        services:     booking.services,
                    },
                },
            });

            await tx.escrowTransaction.update({
                where: { id: escrow.id },
                data:  { status: 'RELEASED', released_at: new Date() },
            });

            await tx.owner.update({
                where: { id: booking.business.owner_id },
                data: {
                    lifetime_earnings: { increment: escrow.amount },
                    current_balance:   { increment: escrow.amount },
                },
            });

            await tx.bookingEvent.create({
                data: {
                    booking_id: bookingId,
                    event_type: 'MONEY_RELEASED',
                    event_data: {
                        escrow_id:   escrow.id,
                        amount:      escrow.amount,
                        business_id: escrow.business_id,
                    },
                },
            });
        });

        logger.info(
            `[Escrow Worker] Released ₹${escrow.amount / 100} for booking ${booking.booking_number}`
        );

        await prisma.businessNotification.create({
            data: {
                business_id: escrow.business_id,
                type:        'PAYMENT_RECEIVED',
                title:       'Payment Received',
                message:     `₹${escrow.amount / 100} credited for booking ${booking.booking_number}`,
                data: {
                    bookingId,
                    amount:       escrow.amount,
                    customerName: booking.customer.name,
                    staffName:    booking.staff.name,
                },
            },
        });

        try {
            await redisClient.del(`cache:business:${escrow.business_id}:wallet`);
            await redisClient.del(`cache:owner:${booking.business.owner_id}:dashboard`);
        } catch (cacheErr) {
            logger.warn('[Escrow Worker] Cache invalidation failed (non-fatal):', cacheErr);
        }

        return { status: 'success', escrowId: escrow.id, amount: escrow.amount };
    },
    {
        connection:  redisClient,
        concurrency: 10,
        limiter: {
            max:      100,
            duration: 1_000,
        },
    }
);

escrowWorker.on('completed', (job, result) => {
    logger.info(`[Escrow Worker] Job ${job.id} completed:`, result);
});

escrowWorker.on('failed', async (job, err) => {
    logger.error(
        `[Escrow Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`
    );

    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
        logger.error('[Escrow Worker] CRITICAL: All retries exhausted — routing to DLQ', {
            bookingId: job.data.bookingId,
            jobId:     job.id,
            error:     err.message,
        });

        try {
            const dlqPayload: DeadLetterJobData = {
                originalQueue: QUEUE_NAMES.ESCROW,
                originalJobId: job.id,
                jobName:       job.name,
                jobData:       job.data,
                error:         err.message,
                attemptsMade:  job.attemptsMade,
                failedAt:      new Date().toISOString(),
            };
            await deadLetterQueue.add('dead-escrow', dlqPayload);
            logger.info(`[Escrow Worker] Job ${job.id} moved to DLQ`);
        } catch (dlqErr) {
            logger.error('[Escrow Worker] CRITICAL: Failed to push to DLQ — manual check required', {
            bookingId: job.data.bookingId,
            dlqError:  dlqErr,
        });
    }
  }
});

escrowWorker.on('error', (err) => {
    logger.error('[Escrow Worker] Worker error:', err.message);
});

export default escrowWorker;