import { Worker, Job } from "bullmq";
import { redisClient } from "../config/redis";
import { processEmail } from "../services/email.services";
import { deadLetterQueue as dlqQueue, QUEUE_NAMES } from "../config/bullmq";
import type { EmailJobPayload } from "../config/bullmq";
import logger from "../config/logger.config";

export const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job: Job<EmailJobPayload>) => {
    logger.info(`[EmailWorker] Processing job ${job.id} type=${job.data.type}`);
    await processEmail(job.data);
    logger.info(`[EmailWorker] Completed job ${job.id}`);
  },
  {
    connection:  redisClient,
    concurrency: 5,
  }
);

emailWorker.on("failed", async (job, err) => {
  logger.error(`[EmailWorker] Job ${job?.id} failed:`, err.message);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await dlqQueue.add("email-dlq", { originalJob: job.data, error: err.message });
  }
});

emailWorker.on("error", (err) => {
  logger.error("[EmailWorker] Worker error:", err.message);
});
