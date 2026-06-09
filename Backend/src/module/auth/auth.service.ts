
import { add } from "date-fns";
import crypto from "crypto";

import { prisma } from "../../config/prisma";
import { generateAvatarUrl } from "../../utils/helpers/avatar";
import { AuthRepository } from "./auth.repository";
import { hashPassword, verifyPassword, generateToken, hashToken } from "../../utils/helpers/crypto";
import { signAccessToken } from "../../utils/helpers/jwt";
import { ConflictError, UnauthorizedError, BadRequestError, NotFoundError } from "../../utils/errors/app.error";
import { toMinimalUser } from "./auth.mapper";
import { queueEmail } from "../../services/email.services";
import { AUTH_MESSAGES } from "../../constants/messages";

import type {
  UserSignupDTO, LoginDTO, StaffSetupDTO, ForgotPasswordDTO,
  ResetPasswordDTO, ChangePasswordDTO, JwtPayload, MinimalUserInfo, TokenResult,
} from "./auth.types";

const MAX_SESSIONS = 5;

export class AuthService {

  static async signup(data: UserSignupDTO): Promise<TokenResult> {
    const existing = await AuthRepository.findUserByEmail(data.email);
    if (existing) throw new ConflictError(AUTH_MESSAGES.EMAIL_EXISTS);

    if (data.role === "CUSTOMER") {
      if (!data.username) throw new BadRequestError("Username is required for customer accounts.");
      const usernameTaken = await AuthRepository.checkUsernameExists(data.username.toLowerCase());
      if (usernameTaken) throw new ConflictError("This username is already taken.");
    }

    if (data.role === "OWNER" && !data.phone) {
      throw new BadRequestError("Phone number is required.");
    }

    const passwordHash = await hashPassword(data.password);
    const user = await AuthRepository.createUser(data.email, passwordHash, data.role);

    let avatarUrl: string;
    if (data.role === "CUSTOMER") {
      avatarUrl = generateAvatarUrl(data.username!);
      await AuthRepository.createCustomerProfile({
        userId: user.id,
        username: data.username!.toLowerCase(),
        name: data.name,
        city: data.city ?? "",
        state: data.state ?? "",
        phone: data.phone,
        avatarUrl,
      });
    } else {
      avatarUrl = generateAvatarUrl(data.name);
      await AuthRepository.createOwnerProfile({
        userId: user.id,
        name: data.name,
        city: data.city ?? "",
        state: data.state ?? "",
        phone: data.phone!,
        avatar_url: avatarUrl,
      });
    }

    const minimalUser = toMinimalUser({
      id: user.id,
      email: user.email,
      name: data.name,
      role: user.role as JwtPayload["role"],
      avatar_url: avatarUrl,
    });

    return AuthService.issueTokens(user.id, user.role as JwtPayload["role"], user.version, minimalUser);
  }

  static async login(
    data: LoginDTO,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<TokenResult> {
    const user = await AuthRepository.findUserByEmail(data.email);
    if (!user) throw new UnauthorizedError(AUTH_MESSAGES.EMAIL_NOT_FOUND);

    if (!user.is_active) throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);

    // KEEP YOUR ORIGINAL ROLE CHECKS
    switch (user.role) {
      case "STAFF": {
        if (!user.password_hash) {
          throw new UnauthorizedError("Account not setup.");
        }
        const staff = await AuthRepository.findStaffByUserId(user.id);
        if (!staff?.is_active) throw new UnauthorizedError("Inactive staff.");
        break;
      }
      case "ADMIN": {
        const admin = await AuthRepository.findAdminByUserId(user.id);
        if (!admin?.is_active) throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
        break;
      }
      default: break;
    }

    const isValid = await verifyPassword(data.password, user.password_hash!);
    if (!isValid) throw new UnauthorizedError(AUTH_MESSAGES.WRONG_PASSWORD);

    const sessions = await AuthRepository.countActiveRefreshTokens(user.id);
    if (sessions >= MAX_SESSIONS) await AuthRepository.revokeAllUserTokens(user.id);

    await AuthRepository.updateLastLogin(user.id);

    if (user.role === "CUSTOMER") {
      const customer = await AuthRepository.findCustomerByUserId(user.id);
      if (customer) await AuthRepository.setFirstLoginAtIfNull(customer.id);
    }

    const displayName = await AuthService.getNameByRole(user.id, user.role as JwtPayload["role"]);
    const avatarUrl = await AuthService.getAvatarByRole(user.id, user.role as JwtPayload["role"]);

    const minimalUser = toMinimalUser({
      id: user.id,
      email: user.email,
      name: displayName,
      role: user.role as JwtPayload["role"],
      avatar_url: avatarUrl,
    });

    return AuthService.issueTokens(user.id, user.role as JwtPayload["role"], user.version, minimalUser, meta);
  }

  static async refreshAccessToken(
    refreshToken: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const stored = await AuthRepository.findRefreshToken(refreshToken);

    if (!stored) throw new UnauthorizedError("Invalid token");
    if (stored.is_revoked) throw new UnauthorizedError("Session revoked");
    if (stored.expires_at < new Date()) throw new UnauthorizedError("Token expired");

    // Token rotation — invalidate old, issue new
    await AuthRepository.revokeRefreshToken(refreshToken);

    const user = await AuthRepository.findUserById(stored.user_id);
    if (!user) throw new UnauthorizedError("User not found");
    if (!user.is_active) throw new UnauthorizedError("Account deactivated");

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role as JwtPayload["role"],
      version: user.version,
      entityId: user.id,
    });

    const newRefresh = crypto.randomBytes(64).toString("hex");

    await AuthRepository.saveRefreshToken({
      userId:    user.id,
      token:     newRefresh,
      expiresAt: add(new Date(), { days: 7 }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken, refreshToken: newRefresh };
  }

  static async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    try { await AuthRepository.revokeRefreshToken(refreshToken); } catch {}
  }

  // ── Forgot Password ─────────────────────────────────────────
  static async forgotPassword(dto: ForgotPasswordDTO): Promise<void> {
    const user = await AuthRepository.findUserByEmail(dto.email);
    // Always return success message — don't leak whether email exists
    if (!user || !user.is_active) return;

    const rawToken    = generateToken();
    const hashedToken = hashToken(rawToken);

    await AuthRepository.createPasswordResetToken({
      userId:    user.id,
      token:     hashedToken,
      expiresAt: add(new Date(), { hours: 1 }),
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;

    queueEmail({
      to:   user.email,
      type: "password-reset",
      data: { resetUrl, expiresIn: "1 hour" },
    }).catch(() => {});
  }

  // ── Reset Password ──────────────────────────────────────────
  static async resetPassword(dto: ResetPasswordDTO): Promise<void> {
    const hashedToken = hashToken(dto.token);
    const record      = await AuthRepository.findPasswordResetToken(hashedToken);

    if (!record) throw new BadRequestError("Reset link is invalid or has expired.");

    const passwordHash = await hashPassword(dto.newPassword);

    await AuthRepository.updatePassword(record.user_id, passwordHash);
    await AuthRepository.markResetTokenUsed(record.id);

    // Increment version → invalidates all existing access tokens
    await AuthRepository.incrementUserVersion(record.user_id);

    // Revoke all sessions → force re-login everywhere
    await AuthRepository.revokeAllUserTokens(record.user_id);

    const user = await AuthRepository.findUserById(record.user_id);
    queueEmail({
      to:   user?.email ?? "",
      type: "change-password-confirmation",
      data: {},
    }).catch(() => {});
  }

  // ── Staff Setup (first-time password set via invitation link) ─
  static async staffSetup(
    dto: StaffSetupDTO,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<TokenResult> {
    const hashedToken = hashToken(dto.token);
    const record      = await AuthRepository.findStaffSetupToken(hashedToken);

    if (!record) throw new BadRequestError("Setup link is invalid or has expired.");
    if (record.user.password_hash) {
      throw new BadRequestError("This account has already been set up. Please log in.");
    }

    const passwordHash = await hashPassword(dto.newPassword);

    await AuthRepository.activateStaffAccount(record.user_id, passwordHash);
    await AuthRepository.markSetupTokenUsed(record.id);

    const user = await AuthRepository.findUserById(record.user_id);
    if (!user) throw new NotFoundError("User not found.");

    const staffProfile = await AuthRepository.findStaffByUserId(user.id);
    const displayName  = staffProfile?.name ?? "";
    const avatarUrl    = staffProfile?.avatar_url ?? null;

    const minimalUser = toMinimalUser({
      id:   user.id,
      email: user.email,
      name:  displayName,
      role:  "STAFF",
      avatar_url: avatarUrl,
    });

    return AuthService.issueTokens(user.id, "STAFF", user.version, minimalUser, meta);
  }

  // ── Change Password (authenticated) ─────────────────────────
  static async changePassword(userId: string, dto: ChangePasswordDTO): Promise<void> {
    const user = await AuthRepository.findUserById(userId);
    if (!user) throw new NotFoundError("User not found.");

    const isValid = await verifyPassword(dto.currentPassword, user.password_hash!);
    if (!isValid) throw new UnauthorizedError("Current password is incorrect.");

    const newHash = await hashPassword(dto.newPassword);
    await AuthRepository.updatePassword(userId, newHash);

    // Increment version → all existing access tokens become invalid
    await AuthRepository.incrementUserVersion(userId);

    // Revoke all refresh tokens → force re-login on all devices
    await AuthRepository.revokeAllUserTokens(userId);

    queueEmail({
      to:   user.email,
      type: "change-password-confirmation",
      data: {},
    }).catch(() => {});
  }

  // ── Delete Account ───────────────────────────────────────────
  static async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await AuthRepository.findUserById(userId);
    if (!user) throw new NotFoundError("User not found.");

    const isValid = await verifyPassword(password, user.password_hash!);
    if (!isValid) throw new UnauthorizedError("Password is incorrect.");

    // Check for active/confirmed bookings — don't delete with pending obligations
    if (user.role === "CUSTOMER") {
      const customer = await AuthRepository.findCustomerByUserId(userId);
      if (customer) {
        const activeBookings = await prisma.booking.count({
          where: {
            customer_id: customer.id,
            status:      { in: ["PENDING_PAYMENT", "CONFIRMED", "RUNNING"] },
          },
        });
        if (activeBookings > 0) {
          throw new BadRequestError(
            `Cannot delete account: ${activeBookings} active booking(s) exist. Please cancel them first.`
          );
        }
      }
    }

    // Revoke all sessions first, then delete user (cascades via Prisma relations)
    await AuthRepository.revokeAllUserTokens(userId);
    await AuthRepository.deleteUser(userId);

    queueEmail({
      to:   user.email,
      type: "account-deleted",
      data: {},
    }).catch(() => {});
  }

  // 🔥 IMPORTANT FIX HERE
  private static async issueTokens(
    userId: string,
    role: JwtPayload["role"],
    version: number,
    user: MinimalUserInfo,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<TokenResult> {

    const accessToken = signAccessToken({ userId, role, version, entityId: userId });

    // ✅ FIX: generate INSIDE function
    const refreshToken = crypto.randomBytes(64).toString("hex");

    await AuthRepository.saveRefreshToken({
      userId,
      token: refreshToken,
      expiresAt: add(new Date(), { days: 7 }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken, refreshToken, user };
  }

  static async getNameByRole(userId: string, role: JwtPayload["role"]) {
    switch (role) {
      case "CUSTOMER": return (await AuthRepository.findCustomerByUserId(userId))?.name ?? "";
      case "OWNER": return (await AuthRepository.findOwnerByUserId(userId))?.name ?? "";
      case "STAFF": return (await AuthRepository.findStaffByUserId(userId))?.name ?? "";
      case "ADMIN": return (await AuthRepository.findAdminByUserId(userId))?.name ?? "";
      default: return "";
    }
  }

  static async getAvatarByRole(userId: string, role: JwtPayload["role"]): Promise<string | null> {
    switch (role) {
      case "CUSTOMER": return (await AuthRepository.findCustomerByUserId(userId))?.avatar_url ?? null;
      case "OWNER": return (await AuthRepository.findOwnerByUserId(userId))?.avatar_url ?? null;
      case "STAFF": return (await AuthRepository.findStaffByUserId(userId))?.avatar_url ?? null;
      case "ADMIN": return (await AuthRepository.findAdminByUserId(userId))?.avatar_url ?? null;
      default: return null;
    }
  }
}

