import { prisma } from "../../config/prisma";
export class StaffRepository {

  static async findByUserId(userId: string) {
    return prisma.staff.findUnique({
      where:   { user_id: userId },
      include: {
        business: {
          select: {
            id:             true,
            business_name:  true,
            logo_url:       true,
            owner: { select: { name: true, phone: true, avatar_url: true } },
          },
        },
        services: {
          include: {
            service_offering: {
              include: {
                platform_service: { select: { id: true, name: true, category: true } },
              },
            },
          },
          where: { is_available: true },
        },
        schedules: { orderBy: { day_of_week: "asc" } },
      },
    });
  }

  static async findByPhone(phone: string) {
    return prisma.staff.findFirst({ where: { phone } });
  }

  static async updateProfile(staffId: string, data: Record<string, any>) {
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) payload[k] = v;
    }
    return prisma.staff.update({
      where:   { id: staffId },
      data:    payload,
      include: {
        business: {
          select: {
            id:            true,
            business_name: true,
            logo_url:      true,
            owner: { select: { name: true, phone: true, avatar_url: true } },
          },
        },
        services: {
          include: {
            service_offering: {
              include: {
                platform_service: { select: { id: true, name: true, category: true } },
              },
            },
          },
          where: { is_available: true },
        },
        schedules: { orderBy: { day_of_week: "asc" } },
      },
    });
  }
}
