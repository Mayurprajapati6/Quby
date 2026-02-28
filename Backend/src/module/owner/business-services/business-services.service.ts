import { BusinessServicesRepository } from "./business-services.repository";
import { BusinessRepository } from "../business/business.repository";
import { NotFoundError, ConflictError, ForbiddenError } from "../../../utils/errors/app.error";
import { BUSINESS_MESSAGES } from "../../../constants/messages";

export class BusinessServicesService {

  private static async verifyOwnership(businessId: string, ownerId: string) {
    const business = await BusinessRepository.findByOwnerAndId(businessId, ownerId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);
    return business;
  }

  static async list(businessId: string, ownerId: string) {
    await this.verifyOwnership(businessId, ownerId);
    return BusinessServicesRepository.listByBusiness(businessId);
  }

  static async add(businessId: string, ownerId: string, data: {
    platform_service_id: string;
    price:               number;
    discounted_price?:   number;
    is_featured?:        boolean;
  }) {
    await this.verifyOwnership(businessId, ownerId);

    const platformService = await BusinessServicesRepository.findPlatformService(data.platform_service_id);
    if (!platformService) throw new NotFoundError(BUSINESS_MESSAGES.PLATFORM_SERVICE_NOT_FOUND);

    const existing = await BusinessServicesRepository.findByBusinessAndPlatformService(
      businessId,
      data.platform_service_id
    );
    if (existing) throw new ConflictError(BUSINESS_MESSAGES.SERVICE_ALREADY_EXISTS);

    return BusinessServicesRepository.create({ business_id: businessId, ...data });
  }

  static async update(businessId: string, offeringId: string, ownerId: string, data: {
    price?:            number;
    discounted_price?: number;
    is_active?:        boolean;
    is_featured?:      boolean;
  }) {
    await this.verifyOwnership(businessId, ownerId);

    const offering = await BusinessServicesRepository.findOffering(businessId, offeringId);
    if (!offering) throw new NotFoundError(BUSINESS_MESSAGES.SERVICE_NOT_FOUND);

    return BusinessServicesRepository.update(offeringId, data);
  }

  static async remove(businessId: string, offeringId: string, ownerId: string) {
    await this.verifyOwnership(businessId, ownerId);

    const offering = await BusinessServicesRepository.findOffering(businessId, offeringId);
    if (!offering) throw new NotFoundError(BUSINESS_MESSAGES.SERVICE_NOT_FOUND);

    await BusinessServicesRepository.delete(offeringId);
  }
}