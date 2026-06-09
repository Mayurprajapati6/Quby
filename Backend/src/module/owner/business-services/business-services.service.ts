import { BusinessServicesRepository } from "./business-services.repository";
import { OwnerBusinessRepository } from "../business/business.repository";
import { prisma } from "../../../config/prisma";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import type {
  BusinessServiceOfferingDTO,
  AddBusinessServiceDTO,
  UpdateBusinessServiceDTO,
} from "./business-services.types";

export class BusinessServicesService {

  private static async resolveOwnerId(userId: string): Promise<string> {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");
    return owner.id;
  }

  private static async getOwnedBusiness(userId: string, businessId: string) {
    const ownerId  = await this.resolveOwnerId(userId);
    const business = await OwnerBusinessRepository.findByOwnerAndId(ownerId, businessId);
    if (!business) throw new ForbiddenError("Business not found or access denied.");
    return business;
  }

  static async getAll(ownerId: string, businessId: string): Promise<BusinessServiceOfferingDTO[]> {
    const business  = await this.getOwnedBusiness(ownerId, businessId);
    const offerings = await BusinessServicesRepository.findAll(business.id);
    return offerings.map(toDTO);
  }

  static async add(ownerId: string, businessId: string, dto: AddBusinessServiceDTO): Promise<BusinessServiceOfferingDTO> {
    const business = await this.getOwnedBusiness(ownerId, businessId);

    const existing = await BusinessServicesRepository.findByPlatformServiceId(
      business.id,
      dto.platform_service_id,
    );
    if (existing) {
      throw new ConflictError("This service is already added to your business.");
    }

    if (dto.discounted_price !== undefined && dto.discounted_price >= dto.price) {
      throw new BadRequestError("Discounted price must be less than the regular price.");
    }

    const created = await BusinessServicesRepository.create({
      businessId:        business.id,
      platformServiceId: dto.platform_service_id,
      price:             dto.price,
      discountedPrice:   dto.discounted_price,
      isFeatured:        dto.is_featured,
      isActive:          true,
    });

    return toDTO(created);
  }

  static async update(
    ownerId:    string,
    businessId: string,
    serviceId:  string,
    dto:        UpdateBusinessServiceDTO,
  ): Promise<BusinessServiceOfferingDTO> {
    const business = await this.getOwnedBusiness(ownerId, businessId);

    const offering = await BusinessServicesRepository.findById(serviceId, business.id);
    if (!offering) throw new NotFoundError("Service not found.");

    const newPrice    = dto.price            ?? offering.price;
    const newDiscount = dto.discounted_price !== undefined
      ? dto.discounted_price
      : offering.discounted_price;

    if (newDiscount !== null && newDiscount !== undefined && newDiscount >= newPrice) {
      throw new BadRequestError("Discounted price must be less than the regular price.");
    }

    const updated = await BusinessServicesRepository.update(serviceId, business.id, {
      ...(dto.price             !== undefined && { price:            dto.price }),
      ...(dto.discounted_price  !== undefined && { discounted_price: dto.discounted_price }),
      ...(dto.is_featured       !== undefined && { is_featured:      dto.is_featured }),
      ...(dto.is_active         !== undefined && { is_active:        dto.is_active }),
    });

    return toDTO(updated);
  }

  static async remove(ownerId: string, businessId: string, serviceId: string): Promise<void> {
    const business = await this.getOwnedBusiness(ownerId, businessId);

    const offering = await BusinessServicesRepository.findById(serviceId, business.id);
    if (!offering) throw new NotFoundError("Service not found.");

    const hasFuture = await BusinessServicesRepository.hasFutureBookings(serviceId);
    if (hasFuture) {
      throw new BadRequestError(
        "Cannot delete a service with active bookings. Deactivate it instead.",
      );
    }

    await BusinessServicesRepository.delete(serviceId);
  }
}

function toDTO(o: any): BusinessServiceOfferingDTO {
  return {
    id: o.id,
    platform_service: {
      id:          o.platform_service.id,
      name:        o.platform_service.name,
      service_for: o.platform_service.service_for,
      category:    o.platform_service.category,
      image_url:   o.platform_service.image_url ?? null,
    },
    price:            o.price,
    discounted_price: o.discounted_price,
    is_featured:      o.is_featured,
    is_active:        o.is_active,
    created_at:       o.created_at,
  };
}