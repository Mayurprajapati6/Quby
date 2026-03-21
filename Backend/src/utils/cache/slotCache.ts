import { redisClient } from "../../config/redis";
import logger from "../../config/logger.config";

const SLOT_CACHE_TTL = 5 * 60;  

function slotCacheKey(staffId: string, date: string): string {
  return `staff:${staffId}:slots:${date}`;
}

export async function getSlotCache(staffId: string, date: string): Promise<unknown[] | null> {
  try {
    const raw = await redisClient.get(slotCacheKey(staffId, date));
    if (!raw) return null;
    return JSON.parse(raw) as unknown[];
  } catch {
    return null;  
  }
}

export async function setSlotCache(
  staffId: string,
  date:    string,
  slots:   unknown[],
): Promise<void> {
  try {
    await redisClient.setex(
      slotCacheKey(staffId, date),
      SLOT_CACHE_TTL,
      JSON.stringify(slots),
    );
  } catch (err) {
    logger.warn(`[SlotCache] setSlotCache failed (non-fatal): ${err}`);
  }
}

export async function invalidateSlotCache(staffId: string, date: string): Promise<void> {
  try {
    await redisClient.del(slotCacheKey(staffId, date));
    logger.debug(`[SlotCache] Invalidated staff:${staffId}:slots:${date}`);
  } catch (err) {
    logger.warn(`[SlotCache] invalidateSlotCache failed (non-fatal): ${err}`);
  }
}

export async function invalidateSlotCacheMany(
  staffIds: string[],
  date:     string,
): Promise<void> {
  if (staffIds.length === 0) return;
  try {
    await redisClient.del(...staffIds.map(id => slotCacheKey(id, date)));
  } catch (err) {
    logger.warn(`[SlotCache] invalidateSlotCacheMany failed (non-fatal): ${err}`);
  }
}
