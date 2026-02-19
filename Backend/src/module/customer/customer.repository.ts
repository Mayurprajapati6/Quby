import { prisma } from "../../config/prisma";
import { UpdateCustomerProfileRepoDTO } from "./customer.types";

export class CustomerRepository {
  static async findByUserId(userId: string) {
    return prisma.customer.findUnique({
      where: { user_id: userId },
      include: { user: true },
    });
  }

  static async findByPhone(phone: string) {
    return prisma.customer.findFirst({ where: { phone } });
  }

  static async updateProfile(customerId: string, data: UpdateCustomerProfileRepoDTO) {
    return prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(data.name      !== undefined && { name:       data.name }),
        ...(data.phone     !== undefined && { phone:      data.phone }),
        ...(data.city      !== undefined && { city:       data.city }),
        ...(data.state     !== undefined && { state:      data.state }),
        ...(data.gender    !== undefined && { gender:     data.gender }),
        ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
      },
    });
  }
}