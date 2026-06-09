import { PlatformServicesRepository }            from "./platform-services.repository";
import { uploadImageBuffer, deleteFromCloudinary, extractPublicId } from "../../../utils/helpers/cloudinary";
import { redisClient }                            from "../../../config/redis";
import { NotFoundError, ConflictError }           from "../../../utils/errors/app.error";
import { PLATFORM_SERVICE_MESSAGES }              from "../../../constants/messages";
import logger                                     from "../../../config/logger.config";
import type {
  CreatePlatformServiceDTO,
  UpdatePlatformServiceDTO,
  PlatformServiceDTO,
} from "./platform-services.types";

const CACHE_TTL      = 60 * 60 * 24;  
const REDIS_TIMEOUT  = 300;           

function cacheKey(category: string, serviceFor: string): string {
  return `cache:platform-services:${category}:${serviceFor}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => {
      logger.warn(`[PlatformServices] Redis ${label} timed out after ${ms}ms — skipping cache`);
      resolve(null);
    }, ms)
  );
  return Promise.race([promise, timeout]).catch((err) => {
    logger.warn(`[PlatformServices] Redis ${label} error (non-fatal):`, err?.message);
    return null;
  });
}

async function invalidateAllCaches(): Promise<void> {
  try {
    const keys = await withTimeout(
      redisClient.keys("cache:platform-services:*"),
      REDIS_TIMEOUT,
      "KEYS"
    );
    if (keys && (keys as string[]).length > 0) {
      await withTimeout(redisClient.del(...(keys as string[])), REDIS_TIMEOUT, "DEL");
    }
  } catch (err) {
    logger.warn("[PlatformServices] Cache invalidation failed (non-fatal):", err);
  }
}

export class PlatformServicesService {

  static async create(
    data:       CreatePlatformServiceDTO,
    imageFile?: Express.Multer.File,
  ): Promise<PlatformServiceDTO> {
    let imageUrl: string | undefined;
    let publicId: string | undefined;

    if (imageFile) {
      const uploaded = await uploadImageBuffer(imageFile, "SERVICES");
      imageUrl = uploaded.secure_url;
      publicId = uploaded.public_id;
    }

    try {
      const service = await PlatformServicesRepository.create({
        name:        data.name,
        description: data.description,
        category:    data.category,
        service_for: data.service_for,
        image_url:   imageUrl,
        sort_order:  data.sort_order ?? 0,
      });

      await invalidateAllCaches();
      return service as PlatformServiceDTO;
    } catch (err) {
      if (publicId) {
        await deleteFromCloudinary(publicId).catch((e) =>
          logger.error("[PlatformServices] Cloudinary rollback failed:", e)
        );
      }
      throw err;
    }
  }

  static async list(filters: {
    category?:    "SALON";
    service_for?: "MEN" | "UNISEX";
    is_active?:   boolean;
  }): Promise<PlatformServiceDTO[]> {
    const category   = filters.category    ?? "ALL";
    const serviceFor = filters.service_for ?? "ALL";
    const key        = cacheKey(category, serviceFor);

    const cached = await withTimeout(redisClient.get(key), REDIS_TIMEOUT, "GET");
    if (cached) {
      try {
        logger.info(`[PlatformServices] Cache HIT: ${key}`);
        return JSON.parse(cached as string);
      } catch {
        // corrupt JSON in cache — fall through to DB
      }
    }

    const services = await PlatformServicesRepository.findAll(filters);

    withTimeout(
      redisClient.setex(key, CACHE_TTL, JSON.stringify(services)),
      REDIS_TIMEOUT,
      "SET"
    ).catch(() => {/* already warned inside withTimeout */});

    return services as PlatformServiceDTO[];
  }

  static async update(
    id:         string,
    data:       UpdatePlatformServiceDTO,
    imageFile?: Express.Multer.File,
  ): Promise<PlatformServiceDTO> {
    const existing = await PlatformServicesRepository.findById(id);
    if (!existing) throw new NotFoundError(PLATFORM_SERVICE_MESSAGES.NOT_FOUND);

    let imageUrl:    string | undefined;
    let newPublicId: string | undefined;

    if (imageFile) {
      const uploaded = await uploadImageBuffer(imageFile, "SERVICES");
      imageUrl    = uploaded.secure_url;
      newPublicId = uploaded.public_id;
    }

    try {
      const updated = await PlatformServicesRepository.update(id, {
        name:        data.name,
        description: data.description,
        sort_order:  data.sort_order,
        is_active:   data.is_active,
        ...(imageUrl && { image_url: imageUrl }),
      });

      if (imageUrl && existing.image_url) {
        const oldPublicId = extractPublicId(existing.image_url);
        if (oldPublicId) {
          await deleteFromCloudinary(oldPublicId).catch((e) =>
            logger.warn("[PlatformServices] Old image cleanup failed:", e)
          );
        }
      }

      await invalidateAllCaches();
      return updated as PlatformServiceDTO;
    } catch (err) {
      if (newPublicId) {
        await deleteFromCloudinary(newPublicId).catch((e) =>
          logger.error("[PlatformServices] Cloudinary rollback failed:", e)
        );
      }
      throw err;
    }
  }

  static async delete(id: string): Promise<void> {
    const existing = await PlatformServicesRepository.findById(id);
    if (!existing) throw new NotFoundError(PLATFORM_SERVICE_MESSAGES.NOT_FOUND);

    const inUse = await PlatformServicesRepository.countBusinessOfferings(id);
    if (inUse > 0) {
      throw new ConflictError(
        "This service is in use by one or more businesses and cannot be deleted. Deactivate it instead."
      );
    }

    await PlatformServicesRepository.delete(id);

    if (existing.image_url) {
      const oldPublicId = extractPublicId(existing.image_url);
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId).catch((e) =>
          logger.warn("[PlatformServices] Image cleanup on delete failed:", e)
        );
      }
    }

    await invalidateAllCaches();
  }
}
