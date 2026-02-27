import { prisma } from "../../config/prisma";
import { UpdateAdminProfileRepoDTO } from "./admin.types";

export class AdminRepository {
  static async findByUserId(userId: string) {
    return prisma.admin.findUnique({
      where: { user_id: userId },
      include: { user: true },
    });
  }

  static async updateProfile(adminId: string, data: UpdateAdminProfileRepoDTO) {
    return prisma.admin.update({
      where: { id: adminId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
      },
      include: { user: true },
    });
  }
}