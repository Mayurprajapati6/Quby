import { prisma } from "../../../config/prisma";

export class PlatformServicesRepository {

  static async create(data: {
    name:         string;
    category:     "SALON";
    description?: string;
    service_for:  "MEN" | "UNISEX";
    image_url?:   string;
    sort_order?:  number;
  }) {
    return prisma.platformService.create({ data });
  }

  static async findById(id: string) {
    return prisma.platformService.findUnique({ where: { id } });
  }

  static async findAll(filters: {
    service_for?: "MEN" | "UNISEX";
    is_active?:   boolean;
  }) {
    return prisma.platformService.findMany({
      where: {
        ...(filters.service_for && { service_for: filters.service_for }),
        ...(filters.is_active !== undefined && { is_active: filters.is_active }),
      },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
  }

  static async update(id: string, data: {
    name?:        string;
    description?: string;
    image_url?:   string;
    sort_order?:  number;
    is_active?:   boolean;
  }) {
    return prisma.platformService.update({ where: { id }, data });
  }

  static async delete(id: string) {
    return prisma.platformService.delete({ where: { id } });
  }

  static async countBusinessOfferings(platformServiceId: string): Promise<number> {
    return prisma.businessServiceOffering.count({
      where: { platform_service_id: platformServiceId },
    });
  }
}