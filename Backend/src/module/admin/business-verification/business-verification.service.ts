import { BusinessRepository } from "../../owner/business/business.repository";
import { queueEmail } from "../../../services/email.services";
import { socketService } from "../../../socket/socket.service";
import { redisClient } from "../../../config/redis";
import { NotFoundError, BadRequestError } from "../../../utils/errors/app.error";
import { BUSINESS_MESSAGES } from "../../../constants/messages";
import { paginatedResponse } from "../../../utils/helpers/response";
import logger from "../../../config/logger.config";
import { prisma } from "../../../config/prisma";

async function invalidateExploreCache() {
  try {
    const keys = await redisClient.keys("cache:explore:*");
    if (keys.length > 0) await redisClient.del(...keys);
  } catch (err) {
    logger.warn("[BusinessVerification] Explore cache bust failed (non-fatal):", err);
  }
}

export class BusinessVerificationService {

  static async getPendingBusinesses(page: number, limit: number) {
    const { businesses, total } = await BusinessRepository.findPendingVerification(page, limit);
    return paginatedResponse(businesses, total, page, limit);
  }

  static async getBusinessDetail(businessId: string) {
    const business = await BusinessRepository.findByIdForAdmin(businessId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);
    return business;
  }

  static async approve(businessId: string, adminId: string) {
    const business = await BusinessRepository.findByIdForAdmin(businessId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);
    if (business.is_verified) throw new BadRequestError(BUSINESS_MESSAGES.ALREADY_VERIFIED);

    const approved = await BusinessRepository.approveWithTransaction(
      businessId,
      business.owner_id
    );

    const owner = await prisma.owner.findUnique({
      where:   { id: business.owner_id },
      include: { user: { select: { id: true, email: true } } },
    });

    if (owner?.user?.id) {
      socketService.notifyBusinessApproved(owner.user.id, {
        businessId,
        businessName: business.business_name,
        message:      `${business.business_name} is now live on the platform!`,
      });
    }

    queueEmail({
      to:   owner?.user?.email ?? "",
      type: "business-approved",
      data: {
        ownerName:    owner?.name ?? "Business Owner",
        businessName: business.business_name,
        slug:         approved.slug,
        dashboardUrl: `${process.env.CLIENT_URL}/dashboard`,
      },
    }).catch((err) => logger.warn("[BusinessVerification] Approval email failed:", err));

    await invalidateExploreCache();
    await redisClient.del(`cache:business:${business.slug}`).catch(() => {});

    return approved;
  }

  static async reject(businessId: string, reason: string) {
    const business = await BusinessRepository.findByIdForAdmin(businessId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);
    if (business.is_verified) throw new BadRequestError(BUSINESS_MESSAGES.ALREADY_VERIFIED);

    const rejected = await BusinessRepository.reject(businessId, reason);

    const owner = await prisma.owner.findUnique({
      where:   { id: business.owner_id },
      include: { user: { select: { id: true, email: true } } },
    });

    if (owner?.user?.id) {
      socketService.notifyBusinessRejected(owner.user.id, {
        businessId,
        businessName: business.business_name,
        reason,
      });
    }

    queueEmail({
      to:   owner?.user?.email ?? "",
      type: "business-rejected",
      data: {
        ownerName:       owner?.name ?? "Business Owner",
        businessName:    business.business_name,
        rejectionReason: reason,
        dashboardUrl:    `${process.env.CLIENT_URL}/dashboard`,
      },
    }).catch((err) => logger.warn("[BusinessVerification] Rejection email failed:", err));

    await redisClient.del(`cache:business:${business.slug}`).catch(() => {});

    return rejected;
  }
}