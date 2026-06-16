import IORedis from "ioredis";
import { serverConfig } from "./index";
import logger from "./logger.config";

function createRedisClient(name: string): IORedis {
  
  const commonOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 10000,
    retryStrategy(times: number) {
      if (times > 10) {
        logger.error(`[Redis:${name}] Max retries reached — giving up`);
        return null;
      }

      const delay = Math.min(times * 200, 3000);

      logger.warn(
        `[Redis:${name}] Retrying in ${delay}ms (attempt ${times})`
      );

      return delay;
    },
  };

  console.log({
  REDIS_URL: serverConfig.REDIS_URL,
  REDIS_HOST: serverConfig.REDIS_HOST,
  REDIS_PORT: serverConfig.REDIS_PORT,
});

  const useUpstash =
  serverConfig.NODE_ENV === "production" &&
  !!serverConfig.REDIS_URL;

const client = useUpstash
  ? new IORedis(serverConfig.REDIS_URL, commonOptions)
  : new IORedis({
      host: serverConfig.REDIS_HOST,
      port: serverConfig.REDIS_PORT,
      password: serverConfig.REDIS_PASSWORD || undefined,
      db: serverConfig.REDIS_DB,
      ...commonOptions,
    });

  client.on("connect", () =>
    logger.info(`[Redis:${name}] Connected`)
  );

  client.on("ready", () =>
    logger.info(`[Redis:${name}] Ready`)
  );

  client.on("error", (err) =>
    logger.error(`[Redis:${name}] Error:`, err.message)
  );

  client.on("close", () =>
    logger.warn(`[Redis:${name}] Connection closed`)
  );

  client.on("reconnecting", () =>
    logger.info(`[Redis:${name}] Reconnecting...`)
  );

  return client;
}

export const redisClient = createRedisClient("main");

export const redisPub = createRedisClient("pub");

export const redisSub = createRedisClient("sub");

export async function closeRedisConnections(): Promise<void> {
  logger.info("[Redis] Closing all connections...");
  await Promise.allSettled([
    redisClient.quit(),
    redisPub.quit(),
    redisSub.quit(),
  ]);
  logger.info("[Redis] All connections closed.");
}
