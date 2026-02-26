import Redis from 'ioredis';
import { serverConfig } from './index';
import logger from './logger.config';

const redisOptions = {
    host:               serverConfig.REDIS_HOST ?? 'localhost',
    port:               serverConfig.REDIS_PORT ?? 6379,
    maxRetriesPerRequest: 3,
    enableReadyCheck:   true,
    lazyConnect:        false,
    keepAlive:          30_000,
    connectTimeout:     10_000,
    retryStrategy(times: number) {
        if (times > 10) {
            logger.error('[Redis] Max retry attempts reached. Giving up.');
            return null; 
        }
        const delay = Math.min(times * 200, 3_000);
        logger.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})...`);
        return delay;
    },
};

export const redisClient = new Redis(redisOptions);

export const redisPub = new Redis(redisOptions);
export const redisSub = new Redis(redisOptions);

redisClient.on('connect', () => logger.info('[Redis] Client connected'));
redisClient.on('ready',   () => logger.info('[Redis] Client ready'));
redisClient.on('error',   (err) => logger.error('[Redis] Client error:', err.message));
redisClient.on('close',   () => logger.warn('[Redis] Client connection closed'));
redisClient.on('reconnecting', () => logger.warn('[Redis] Client reconnecting...'));

redisPub.on('error', (err) => logger.error('[Redis Pub] Error:', err.message));
redisSub.on('error', (err) => logger.error('[Redis Sub] Error:', err.message));

export async function checkRedisHealth(): Promise<boolean> {
    try {
        const pong = await redisClient.ping();
        return pong === 'PONG';
    } catch {
        return false;
    }
}

export async function closeRedisConnections(): Promise<void> {
    await Promise.all([
        redisClient.quit(),
        redisPub.quit(),
        redisSub.quit(),
    ]);
    logger.info('[Redis] All connections closed');
}