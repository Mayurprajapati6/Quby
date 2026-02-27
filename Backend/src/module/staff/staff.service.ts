import { StaffRepository } from "./staff.repository";
import { toStaffProfile } from "./staff.mapper";
import { UpdateStaffProfileDTO, StaffProfile } from "./staff.types";
import { uploadImage, deleteFromCloudinary } from "../../utils/helpers/cloudinary";
import { NotFoundError, BadRequestError } from "../../utils/errors/app.error";
import { redisClient } from "../../config/redis";
import logger from "../../config/logger.config";

const CACHE_TTL = 60 * 5;

function cacheKey(staffId: string): string {
  return `cache:staff:${staffId}:profile`;
}

export class StaffService {

    static async getProfile(userId: string): Promise<StaffProfile> {
        const staff = await StaffRepository.findByUserId(userId);
        if (!staff) throw new NotFoundError("Staff profile not found.");

        const key = cacheKey(staff.id);

        try {
            const cached = await redisClient.get(key);
            if (cached) {
                logger.info(`[Staff] Cache HIT: ${key}`);
                return JSON.parse(cached) as StaffProfile;
            }
        } catch (err) {
            logger.warn(`[Staff] Cache GET failed (non-fatal): ${err}`);
        }

        logger.info(`[Staff] Cache MISS: ${key}`);
        const profile = toStaffProfile(staff.user, staff);

        try {
            await redisClient.setex(key, CACHE_TTL, JSON.stringify(profile));
        } catch (err) {
            logger.warn(`[Staff] Cache SET failed (non-fatal): ${err}`);
        }

        return profile;
    }
    static async updateProfile(
        userId: string,
        data:   UpdateStaffProfileDTO
    ): Promise<StaffProfile> {
        const staff = await StaffRepository.findByUserId(userId);
        if (!staff) throw new NotFoundError("Staff profile not found.");

        let newAvatarUrl:    string | undefined;
        let newPublicId:     string | undefined;
        let oldAvatarPublicId: string | undefined;

        if (data.avatar) {
      
            if (staff.avatar_url) {
                oldAvatarPublicId = extractPublicId(staff.avatar_url);
            }

        try {
            const uploaded = await uploadImage(data.avatar, "PROFILES");
            newAvatarUrl = uploaded.secure_url;
            newPublicId  = uploaded.public_id;
        } catch (err: any) {
            throw new BadRequestError(`Avatar upload failed: ${err.message}`);
        }
    }

    try {
        await StaffRepository.updateProfile(staff.id, {
            ...(newAvatarUrl       !== undefined && { avatar_url:       newAvatarUrl }),
            ...(data.bio           !== undefined && { bio:              data.bio }),
            ...(data.experience_years !== undefined && { experience_years: data.experience_years }),
        });
    } catch (err) {
      
        if (newPublicId) {
            try {
                await deleteFromCloudinary(newPublicId);
                logger.info(`[Staff] Cloudinary rollback successful: ${newPublicId}`);
            } catch (cleanupErr) {
        
                logger.error(
                    `[Staff] Cloudinary rollback FAILED for ${newPublicId} — manual cleanup needed`,
                    cleanupErr
                );
            }
        }
        throw err;
    }

    if (oldAvatarPublicId && newAvatarUrl) {
        try {
            await deleteFromCloudinary(oldAvatarPublicId);
        } catch {
            logger.warn(`[Staff] Old avatar cleanup failed (non-fatal): ${oldAvatarPublicId}`);
        }
    }

    try {
        await redisClient.del(cacheKey(staff.id));
        logger.info(`[Staff] Cache invalidated: ${cacheKey(staff.id)}`);
    } catch (err) {
        logger.warn(`[Staff] Cache DEL failed (non-fatal): ${err}`);
    }

    const updated = await StaffRepository.findByUserId(userId);
    return toStaffProfile(updated!.user, updated!);
  }
}

function extractPublicId(url: string): string | undefined {
    try {
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
        return match?.[1];
    } catch {
        return undefined;
    }
}