import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { sendEmail } from '../../src/services/email.services';
import { QUEUE_NAMES, deadLetterQueue, DeadLetterJobData } from '../config/bullmq';
import logger from '../config/logger.config';
import type { EmailJobType } from '../config/bullmq';

interface EmailJobData {
    to:   string;
    type: EmailJobType;
    data: Record<string, unknown>;
}

export const emailWorker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
        const { to, type, data } = job.data;
        logger.info(`[Email Worker] Processing job ${job.id}: '${type}' → ${to}`);
        await sendEmail(to, type, data);
        return { success: true, to, type };
    },
    {
        connection:  redisClient,
        concurrency: 5,           
        limiter: {
            max:      100,          
            duration: 60_000,    
        },
    }
);

emailWorker.on('completed', (job) => {
    logger.info(`[Email Worker] Job ${job.id} completed (${job.data.type} → ${job.data.to})`);
});

emailWorker.on('failed', async (job, err) => {
    logger.error(`[Email Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);

    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
        logger.error(`[Email Worker] All retries exhausted for job ${job.id} — routing to DLQ`, {
            type:      job.data.type,
            recipient: job.data.to,
            error:     err.message,
        });

        try {
            const dlqPayload: DeadLetterJobData = {
                originalQueue: QUEUE_NAMES.EMAIL,
                originalJobId: job.id,
                jobName:       job.name,
                jobData:       job.data,
                error:         err.message,
                attemptsMade:  job.attemptsMade,
                failedAt:      new Date().toISOString(),
            };
            await deadLetterQueue.add('dead-email', dlqPayload);
            logger.info(`[Email Worker] Job ${job.id} moved to DLQ`);
        } catch (dlqErr) {
            logger.error('[Email Worker] Failed to push to DLQ:', dlqErr);
        }
    }
});

emailWorker.on('error', (err) => {
    logger.error('[Email Worker] Worker error:', err.message);
});

export default emailWorker;