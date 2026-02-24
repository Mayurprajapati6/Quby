import { prisma } from "../../config/prisma";
import {
  CreateCustomerProfileDTO,
  CreateOwnerProfileDTO,
  SaveRefreshTokenDTO,
  CreatePasswordResetTokenDTO,
  CreateStaffSetupTokenDTO,
} from "./auth.types";

export class AuthRepository {
  
  static async createUser(
    email: string,
    passwordHash: string,
    role: "CUSTOMER" | "OWNER"
  ) {
    return prisma.user.create({
      data: { email, password_hash: passwordHash, role },
    });
  }

  static async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  static async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  static async updateLastLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { last_login_at: new Date() },
    });
  }

  static async incrementUserVersion(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { version: { increment: 1 } },
    });
  }

  static async updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { password_hash: passwordHash },
    });
  }

  static async deleteUser(userId: string) {
    return prisma.user.delete({ where: { id: userId } });
  }

  static async createCustomerProfile(data: CreateCustomerProfileDTO) {
    return prisma.customer.create({
      data: {
        user_id: data.userId,
        name: data.name,
        city: data.city,
        state: data.state,
        phone: data.phone,
      },
    });
  }

  static async createCustomerWallet(customerId: string) {
    return prisma.customerWallet.create({
      data: { customer_id: customerId, balance: 0, currency: "INR" },
    });
  }

  static async findCustomerByUserId(userId: string) {
    return prisma.customer.findUnique({ where: { user_id: userId } });
  }

  static async createOwnerProfile(data: CreateOwnerProfileDTO) {
    return prisma.owner.create({
      data: {
        user_id: data.userId,
        name: data.name,
        city: data.city,
        state: data.state,
        phone: data.phone,
      },
    });
  }

  static async findOwnerByUserId(userId: string) {
    return prisma.owner.findUnique({ where: { user_id: userId } });
  }

  static async findStaffByEmail(email: string) {
    return prisma.staff.findFirst({
      where: { email },
      include: { user: true },
    });
  }

  static async findStaffByUserId(userId: string) {
    return prisma.staff.findUnique({ where: { user_id: userId } });
  }

  static async activateStaffAccount(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: passwordHash,
        is_verified: true,
      },
    });
  }

  static async findAdminByUserId(userId: string) {
    return prisma.admin.findUnique({ where: { user_id: userId } });
  }

  static async saveRefreshToken(data: SaveRefreshTokenDTO) {
    return prisma.refreshToken.create({
      data: {
        user_id: data.userId,
        token: data.token,
        expires_at: data.expiresAt,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
      },
    });
  }

  static async findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({ where: { token } });
  }

  static async revokeRefreshToken(token: string) {
    return prisma.refreshToken.updateMany({
      where: { token },
      data: { is_revoked: true, revoked_at: new Date() },
    });
  }

  static async revokeAllUserTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { user_id: userId, is_revoked: false },
      data: { is_revoked: true, revoked_at: new Date() },
    });
  }

  static async countActiveRefreshTokens(userId: string): Promise<number> {
    return prisma.refreshToken.count({
      where: {
        user_id: userId,
        is_revoked: false,
        expires_at: { gt: new Date() },
      },
    });
  }

  static async createPasswordResetToken(data: CreatePasswordResetTokenDTO) {

    await prisma.passwordResetToken.updateMany({
      where: { user_id: data.userId, is_used: false },
      data: { is_used: true, used_at: new Date() },
    });

    return prisma.passwordResetToken.create({
      data: {
        user_id: data.userId,
        token: data.token,
        expires_at: data.expiresAt,
      },
    });
  }

  static async findPasswordResetToken(hashedToken: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        token: hashedToken,
        is_used: false,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  static async markResetTokenUsed(tokenId: string) {
    return prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { is_used: true, used_at: new Date() },
    });
  }

  static async createStaffSetupToken(data: CreateStaffSetupTokenDTO) {

    await prisma.emailVerificationToken.updateMany({
      where: { user_id: data.userId, is_used: false },
      data: { is_used: true, used_at: new Date() },
    });

    return prisma.emailVerificationToken.create({
      data: {
        user_id: data.userId,
        token: data.token,
        expires_at: data.expiresAt,
      },
    });
  }

  static async findStaffSetupToken(hashedToken: string) {
    return prisma.emailVerificationToken.findFirst({
      where: {
        token: hashedToken,
        is_used: false,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  static async markSetupTokenUsed(tokenId: string) {
    return prisma.emailVerificationToken.update({
      where: { id: tokenId },
      data: { is_used: true, used_at: new Date() },
    });
  }
}