import { AdminRepository } from "./admin.repository";
import { NotFoundError } from "../../utils/errors/app.error";
import { toAdminProfile } from "./admin.mapper";
import { AdminProfile, UpdateAdminProfileDTO } from "./admin.types";

export class AdminService {
    
  static async getProfile(userId: string): Promise<AdminProfile> {
    const admin = await AdminRepository.findByUserId(userId);
    if (!admin) throw new NotFoundError("Admin profile not found.");

    return toAdminProfile(admin.user, admin);
  }

  static async updateProfile(
    userId: string,
    data: UpdateAdminProfileDTO
  ): Promise<AdminProfile> {
    const admin = await AdminRepository.findByUserId(userId);
    if (!admin) throw new NotFoundError("Admin profile not found.");

    const updated = await AdminRepository.updateProfile(admin.id, {
      name: data.name,
    });

    return toAdminProfile(updated.user, updated);
  }
}