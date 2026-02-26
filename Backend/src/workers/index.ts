import logger from '../config/logger.config';
import emailWorker        from './email.worker';
import escrowWorker       from './escrow.worker';
import notificationWorker from './notification.worker';
import bookingWorker      from './booking.worker';

const workers = [
    { worker: emailWorker,        name: 'email-worker',        concurrency: 5  },
    { worker: escrowWorker,       name: 'escrow-worker',       concurrency: 10 },
    { worker: notificationWorker, name: 'notification-worker', concurrency: 10 },
    { worker: bookingWorker,      name: 'booking-worker',      concurrency: 20 },
];

export function startWorkers(): void {
    logger.info(`[Workers] Starting ${workers.length} workers...`);
    workers.forEach(({ name, concurrency }) => {
        logger.info(`[Workers] ${name} (concurrency: ${concurrency})`);
    });
}

export async function stopWorkers(): Promise<void> {
    logger.info('[Workers] Shutting down workers...');
    await Promise.all(workers.map(({ worker }) => worker.close()));
    logger.info('[Workers] All workers stopped');
}

export { emailWorker, escrowWorker, notificationWorker, bookingWorker };