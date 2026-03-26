import { prisma } from "../../config/prisma";

export class CustomerRepository {

  static async findByUserId(userId: string) {
    return prisma.customer.findUnique({
      where:   { user_id: userId },
      include: {
        user: {
          select: {
            id:            true,
            email:         true,
            last_login_at: true,
            is_suspended:  true,
            created_at:    true,
          },
        },
      },
    });
  }

  static async findById(customerId: string) {
    return prisma.customer.findUnique({
      where:   { id: customerId },
      include: { user: { select: { email: true, last_login_at: true } } },
    });
  }

  static async findByPhone(phone: string) {
    return prisma.customer.findFirst({ where: { phone } });
  }

  static async findByUsername(username: string) {
    return prisma.customer.findUnique({ where: { username } });
  }

  static async updateProfile(
    customerId: string,
    data: {
      name?:          string;
      phone?:         string | null;
      city?:          string;
      state?:         string;
      gender?:        string | null;
      avatar_url?:    string;
      address_line1?: string | null;
      address_line2?: string | null;
    }
  ) {
    return prisma.customer.update({
      where: { id: customerId },
      data,
      include: {
        user: {
          select: {
            id:            true,
            email:         true,
            last_login_at: true,
            created_at:    true,
          },
        },
      },
    });
  }
}
