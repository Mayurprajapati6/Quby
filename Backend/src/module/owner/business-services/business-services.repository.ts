import { prisma } from "../../../config/prisma";
export class BusinessServicesRepository {

  static async findAll(businessId: string) {
    return prisma.businessServiceOffering.findMany({
      where:   { business_id: businessId },
      orderBy: { created_at: "asc" },
      include: { platform_service: true },
    });
  }

  static async findById(serviceId: string, businessId: string) {
    return prisma.businessServiceOffering.findFirst({
      where:   { id: serviceId, business_id: businessId },
      include: { platform_service: true },
    });
  }

  static async findByPlatformServiceId(businessId: string, platformServiceId: string) {
    return prisma.businessServiceOffering.findFirst({
      where: { business_id: businessId, platform_service_id: platformServiceId },
    });
  }

  static async create(data: {
    businessId:         string;
    platformServiceId:  string;
    price:              number;
    discountedPrice?:   number;
    isFeatured?:        boolean;
    isActive?:          boolean;
  }) {
    return prisma.businessServiceOffering.create({
      data: {
        business_id:         data.businessId,
        platform_service_id: data.platformServiceId,
        price:               data.price,
        discounted_price:    data.discountedPrice ?? null,
        is_featured:         data.isFeatured      ?? false,
        is_active:           data.isActive        ?? true,
      },
      include: { platform_service: true },
    });
  }

  static async update(serviceId: string, businessId: string, data: Record<string, any>) {
    return prisma.businessServiceOffering.update({
      where: { id: serviceId },
      data,
      include: { platform_service: true },
    });
  }

  static async delete(serviceId: string) {
    return prisma.businessServiceOffering.delete({ where: { id: serviceId } });
  }

  static async hasFutureBookings(serviceId: string): Promise<boolean> {
    const count = await prisma.booking.count({
      where: {
        status:   { in: ["CONFIRMED", "PENDING_PAYMENT"] },
        staff: {
          services: {
            some: { service_offering_id: serviceId },
          },
        },
      },
    });
    return count > 0;
  }
}
