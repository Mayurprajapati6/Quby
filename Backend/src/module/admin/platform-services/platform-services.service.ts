import { PlatformServicesRepository } from "./platform-services.repository";
import {
  uploadImageBuffer,
  deleteFromCloudinary,
  extractPublicId,
} from "../../../utils/helpers/cloudinary";
import { redisClient }   from "../../../config/redis";
import { NotFoundError, ConflictError } from "../../../utils/errors/app.error";
import { PLATFORM_SERVICE_MESSAGES }    from "../../../constants/messages";
import {
  CreatePlatformServiceDTO,
  UpdatePlatformServiceDTO,
  PlatformServiceDTO,
} from "./platform-services.types";
import logger from "../../../config/logger.config";

const CACHE_TTL = 60 * 60 * 24;

function cacheKey(serviceFor: string): string {
  return `cache:platform-services:${serviceFor}`;
}

async function invalidateAllCaches(): Promise<void> {
  try {
    const keys = await redisClient.keys("cache:platform-services:*");
    if (keys.length > 0) await redisClient.del(...keys);
  } catch (err) {
    logger.warn("[PlatformServices] Cache invalidation failed (non-fatal):", err);
  }
}

export class PlatformServicesService {

  static async create(
    data:       CreatePlatformServiceDTO,
    imageFile?: Express.Multer.File      
  ): Promise<PlatformServiceDTO> {
    let imageUrl:  string | undefined;
    let publicId:  string | undefined;

    if (imageFile) {
      const uploaded = await uploadImageBuffer(imageFile, "SERVICES");
      imageUrl = uploaded.secure_url;
      publicId = uploaded.public_id;
    }

    try {
      const service = await PlatformServicesRepository.create({
        name:        data.name,
        category:    "SALON",
        description: data.description,
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
    service_for?: "MEN" | "UNISEX";
    is_active?:   boolean;
  }): Promise<PlatformServiceDTO[]> {
    const serviceFor = filters.service_for ?? "ALL";
    const key        = cacheKey(serviceFor);

    try {
      const cached = await redisClient.get(key);
      if (cached) {
        logger.info(`[PlatformServices] Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn("[PlatformServices] Cache GET failed (non-fatal):", err);
    }

    const services = await PlatformServicesRepository.findAll(filters);

    try {
      await redisClient.setex(key, CACHE_TTL, JSON.stringify(services));
    } catch (err) {
      logger.warn("[PlatformServices] Cache SET failed (non-fatal):", err);
    }

    return services as PlatformServiceDTO[];
  }

  static async update(
    id:         string,
    data:       UpdatePlatformServiceDTO,
    imageFile?: Express.Multer.File       
  ): Promise<PlatformServiceDTO> {
    const existing = await PlatformServicesRepository.findById(id);
    if (!existing) throw new NotFoundError(PLATFORM_SERVICE_MESSAGES.NOT_FOUND);

    let imageUrl:   string | undefined;
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
          deleteFromCloudinary(oldPublicId).catch((e) =>
            logger.warn("[PlatformServices] Old image cleanup failed (non-fatal):", e)
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
    if (inUse > 0) throw new ConflictError(PLATFORM_SERVICE_MESSAGES.IN_USE);

    await PlatformServicesRepository.delete(id);

    if (existing.image_url) {
      const oldPublicId = extractPublicId(existing.image_url);
      if (oldPublicId) {
        deleteFromCloudinary(oldPublicId).catch((e) =>
          logger.warn("[PlatformServices] Image cleanup on delete failed (non-fatal):", e)
        );
      }
    }

    await invalidateAllCaches();
  }
}