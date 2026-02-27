import { prisma } from "../../config/prisma";
import { UpdateOwnerProfileRepoDTO } from "./owner.types";

export class OwnerRepository {
  static async findByUserId(userId: string) {
    return prisma.owner.findUnique({
      where: { user_id: userId },
      include: { user: true },
    });
  }

  static async findByPhone(phone: string) {
    return prisma.owner.findFirst({ where: { phone } });
  }

  static async updateProfile(ownerId: string, data: UpdateOwnerProfileRepoDTO) {
    return prisma.owner.update({
      where: { id: ownerId },
      data: {
        ...(data.name       !== undefined && { name:       data.name }),
        ...(data.phone      !== undefined && { phone:      data.phone }),
        ...(data.city       !== undefined && { city:       data.city }),
        ...(data.state      !== undefined && { state:      data.state }),
        ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
      },
    });
  }
}