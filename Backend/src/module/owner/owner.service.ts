import { OwnerRepository } from "./owner.repository";
import { uploadImageBuffer } from "../../utils/helpers/cloudinary";
import { ConflictError, NotFoundError, BadRequestError } from "../../utils/errors/app.error";
import { toOwnerProfile } from "./owner.mapper";
import { UpdateOwnerProfileDTO, OwnerProfile } from "./owner.types";

export class OwnerService {

  static async getProfile(userId: string): Promise<OwnerProfile> {
    const owner = await OwnerRepository.findByUserId(userId);
    if (!owner) throw new NotFoundError("Owner profile not found.");
    return toOwnerProfile(owner.user, owner);
  }

  static async updateProfile(
    userId: string,
    data: UpdateOwnerProfileDTO,
    avatarFile?: Express.Multer.File  
  ): Promise<OwnerProfile> {
    const owner = await OwnerRepository.findByUserId(userId);
    if (!owner) throw new NotFoundError("Owner profile not found.");

    if (data.phone) {
      const existing = await OwnerRepository.findByPhone(data.phone);
      if (existing && existing.id !== owner.id) {
        throw new ConflictError("This phone number is already linked to another account.");
      }
    }

    let avatarUrl: string | undefined;
    if (avatarFile) {
      try {
        const uploaded = await uploadImageBuffer(avatarFile, "PROFILES");
        avatarUrl = uploaded.secure_url;
      } catch (error: any) {
        throw new BadRequestError(`Avatar upload failed: ${error.message}`);
      }
    }

    const updated = await OwnerRepository.updateProfile(owner.id, {
      name:  data.name,
      phone: data.phone,
      city:  data.city,
      state: data.state,
      ...(avatarUrl && { avatar_url: avatarUrl }),
    });

    return toOwnerProfile(owner.user, updated);
  }
}