import { prisma } from "../../config/prisma";
import { hashPassword } from "../../utils/helpers/crypto";
import { AuthRepository } from "./auth.repository";
import { queueEmail } from "../../services/email.services";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError
} from "../../utils/errors/app.error";

export interface CreateBusinessAccountDTO {
  email:    string;
  password: string;   
}

export interface ResetBusinessAccountPasswordDTO {
  new_password: string;
}

export interface BusinessAccountInfoDTO {
  user_id:    string;
  email:      string;
  is_active:  boolean;
  created_at: Date;
}

export class BusinessAuthService {

  private static async assertOwnership(
    ownerUserId: string,
    businessId:  string
  ): Promise<{ id: string; business_name: string; auth_user_id: string | null }> {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: ownerUserId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const business = await prisma.business.findFirst({
      where:  { id: businessId, owner_id: owner.id },
      select: { id: true, business_name: true, auth_user_id: true },
    });
    if (!business) {
      throw new UnauthorizedError("This business does not belong to you.");
    }

    return business;
  }

  static async createAccount(
    ownerUserId: string,
    businessId:  string,
    dto:         CreateBusinessAccountDTO
  ): Promise<BusinessAccountInfoDTO> {

    const business = await this.assertOwnership(ownerUserId, businessId);

    if (business.auth_user_id) {
      throw new ConflictError(
        "This business already has a saloon PC login account. " +
        "Use the reset-password endpoint to change its credentials."
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictError("This email address is already in use.");
    }

    const passwordHash = await hashPassword(dto.password);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email:         dto.email,
          password_hash: passwordHash,
          role:          "BUSINESS",
          is_active:     true,
        },
      });

      await tx.business.update({
        where: { id: businessId },
        data:  { auth_user_id: user.id },
      });

      return user;
    });

    const result: BusinessAccountInfoDTO = {
      user_id:    newUser.id,
      email:      newUser.email,
      is_active:  newUser.is_active,
      created_at: newUser.created_at,
    };

    queueEmail({
      to:   dto.email,
      type: "business-credentials",
      data: {
        businessName: business.business_name,
        email:        dto.email,
        password:     dto.password,
      },
    }).catch(() => {});

    return result;
  }

  static async getAccountInfo(
    ownerUserId: string,
    businessId:  string
  ): Promise<BusinessAccountInfoDTO | null> {

    const business = await this.assertOwnership(ownerUserId, businessId);

    if (!business.auth_user_id) return null;

    const user = await prisma.user.findUnique({
      where:  { id: business.auth_user_id },
      select: { id: true, email: true, is_active: true, created_at: true },
    });
    if (!user) return null;

    return {
      user_id:    user.id,
      email:      user.email,
      is_active:  user.is_active,
      created_at: user.created_at,
    };
  }

  static async resetPassword(
    ownerUserId: string,
    businessId:  string,
    dto:         ResetBusinessAccountPasswordDTO
  ): Promise<void> {

    const business = await this.assertOwnership(ownerUserId, businessId);

    if (!business.auth_user_id) {
      throw new NotFoundError(
        "No saloon PC account exists for this business yet. Create one first."
      );
    }

    const passwordHash = await hashPassword(dto.new_password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: business.auth_user_id! },
        data:  {
          password_hash: passwordHash,
          version:       { increment: 1 },
        },
      });

      await tx.refreshToken.updateMany({
        where: { user_id: business.auth_user_id!, is_revoked: false },
        data:  { is_revoked: true },
      });
    });
    
  }

  static async setAccountStatus(
    ownerUserId: string,
    businessId:  string,
    is_active:   boolean
  ): Promise<void> {

    const business = await this.assertOwnership(ownerUserId, businessId);

    if (!business.auth_user_id) {
      throw new NotFoundError("No saloon PC account exists for this business.");
    }

    await prisma.user.update({
      where: { id: business.auth_user_id },
      data:  { is_active },
    });

    if (!is_active) {
      await AuthRepository.revokeAllUserTokens(business.auth_user_id);
    }
  }

  static async deleteAccount(
    ownerUserId: string,
    businessId:  string
  ): Promise<void> {

    const business = await this.assertOwnership(ownerUserId, businessId);

    if (!business.auth_user_id) {
      throw new NotFoundError("No saloon PC account exists for this business.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: businessId },
        data:  { auth_user_id: null },
      });

      await tx.user.delete({
        where: { id: business.auth_user_id! },
      });
    });
  }
}
