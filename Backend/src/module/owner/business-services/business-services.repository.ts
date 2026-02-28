import { prisma } from "../../../config/prisma";

export class BusinessServicesRepository {

  static async findOffering(businessId: string, offeringId: string) {
    return prisma.businessServiceOffering.findFirst({
      where: { id: offeringId, business_id: businessId },
      include: { platform_service: true },
    });
  }

  static async findByBusinessAndPlatformService(businessId: string, platformServiceId: string) {
    return prisma.businessServiceOffering.findUnique({
      where: { business_id_platform_service_id: { business_id: businessId, platform_service_id: platformServiceId } },
    });
  }

  static async listByBusiness(businessId: string) {
    return prisma.businessServiceOffering.findMany({
      where:   { business_id: businessId },
      include: { platform_service: { select: { name: true, category: true, service_for: true } } },
      orderBy: { platform_service: { name: "asc" } },
    });
  }

  static async create(data: {
    business_id:         string;
    platform_service_id: string;
    price:               number;
    discounted_price?:   number;
    is_featured?:        boolean;
  }) {
    return prisma.businessServiceOffering.create({ data });
  }

  static async update(offeringId: string, data: {
    price?:            number;
    discounted_price?: number;
    is_active?:        boolean;
    is_featured?:      boolean;
  }) {
    return prisma.businessServiceOffering.update({ where: { id: offeringId }, data });
  }

  static async delete(offeringId: string) {
    return prisma.businessServiceOffering.delete({ where: { id: offeringId } });
  }

  static async findPlatformService(id: string) {
    return prisma.platformService.findFirst({ where: { id, is_active: true } });
  }
}