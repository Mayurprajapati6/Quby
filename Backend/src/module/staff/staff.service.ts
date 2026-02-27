import { StaffRepository }   from "./staff.repository";
import { toStaffProfile }    from "./staff.mapper";
import { UpdateStaffProfileDTO, StaffProfile } from "./staff.types";
import {
  uploadImageBuffer,
  deleteFromCloudinary,
  extractPublicId,
} from "../../utils/helpers/cloudinary";
import { NotFoundError, BadRequestError } from "../../utils/errors/app.error";
import { redisClient }  from "../../config/redis";
import logger           from "../../config/logger.config";

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
        userId:    string,
        data:      UpdateStaffProfileDTO,
        avatarFile?: Express.Multer.File      // ← multer file (optional)
    ): Promise<StaffProfile> {
        const staff = await StaffRepository.findByUserId(userId);
        if (!staff) throw new NotFoundError("Staff profile not found.");

        let newAvatarUrl:     string | undefined;
        let newPublicId:      string | undefined;
        let oldAvatarPublicId: string | undefined;

        if (avatarFile) {
            if (staff.avatar_url) {
                oldAvatarPublicId = extractPublicId(staff.avatar_url);
            }

            try {
                const uploaded = await uploadImageBuffer(avatarFile, "PROFILES");
                newAvatarUrl = uploaded.secure_url;
                newPublicId  = uploaded.public_id;
            } catch (err: any) {
                throw new BadRequestError(`Avatar upload failed: ${err.message}`);
            }
        }

        try {
            await StaffRepository.updateProfile(staff.id, {
                ...(newAvatarUrl              !== undefined && { avatar_url:       newAvatarUrl }),
                ...(data.bio                  !== undefined && { bio:              data.bio }),
                ...(data.experience_years     !== undefined && { experience_years: data.experience_years }),
            });
        } catch (err) {
            if (newPublicId) {
                await deleteFromCloudinary(newPublicId).catch((e) =>
                    logger.error(`[Staff] Cloudinary rollback FAILED for ${newPublicId}:`, e)
                );
            }
            throw err;
        }

        if (oldAvatarPublicId && newAvatarUrl) {
            deleteFromCloudinary(oldAvatarPublicId).catch(() =>
                logger.warn(`[Staff] Old avatar cleanup failed (non-fatal): ${oldAvatarPublicId}`)
            );
        }

        redisClient.del(cacheKey(staff.id)).catch((err) =>
            logger.warn(`[Staff] Cache DEL failed (non-fatal): ${err}`)
        );

        const updated = await StaffRepository.findByUserId(userId);
        return toStaffProfile(updated!.user, updated!);
    }
}