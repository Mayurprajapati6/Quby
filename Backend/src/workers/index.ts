import { emailWorker } from "./email.worker";
import { settleWorker } from "./settle.worker";
import { refundWorker } from "./refund.worker";
import { bookingWorker } from "./booking.worker";
import { notificationWorker } from "./notification.worker";
import { analyticsWorker } from "./analytics.worker";
import logger from "../config/logger.config";

const workers = [
  emailWorker,
  settleWorker,
  refundWorker,
  bookingWorker,
  notificationWorker,
  analyticsWorker,
];

export async function startWorkers(): Promise<void> {
  logger.info("[Workers] All BullMQ workers are active.");
  logger.info(`[Workers] Running: ${workers.map(w => w.name).join(", ")}`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map(w => w.close()));
  logger.info("[Workers] All BullMQ workers stopped.");
}

export { emailWorker }  from "./email.worker";
export { settleWorker } from "./settle.worker";
export { refundWorker } from "./refund.worker";
export { bookingWorker } from "./booking.worker";
export { notificationWorker } from "./notification.worker";
export { analyticsWorker } from "./analytics.worker";
