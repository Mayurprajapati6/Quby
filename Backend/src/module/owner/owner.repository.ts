import { prisma } from "../../config/prisma";

export class OwnerRepository {

  static async findByUserId(userId: string) {
    return prisma.owner.findUnique({
      where:   { user_id: userId },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  static async findById(id: string) {
    return prisma.owner.findUnique({
      where:   { id },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  static async findByPhone(phone: string) {
    return prisma.owner.findFirst({ where: { phone } });
  }

  static async updateProfile(
    id:   string,
    data: {
      name?:          string;
      phone?:         string;
      city?:          string;
      state?:         string;
      address_line1?: string;
      address_line2?: string;
      avatar_url?:    string;
    }
  ) {
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) payload[k] = v;
    }
    return prisma.owner.update({
      where:   { id },
      data:    payload,
      include: { user: { select: { id: true, email: true } } },
    });
  }
}
