import { add } from "date-fns";
import { generateAvatarUrl } from "../../utils/helpers/avatar";

import { AuthRepository } from "./auth.repository";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
} from "../../utils/helpers/crypto";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/helpers/jwt";
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
} from "../../utils/errors/app.error";
import { toMinimalUser } from "./auth.mapper";
import { queueEmail }  from "../../services/email.services";
import { AUTH_MESSAGES } from "../../constants/messages";
import type {
  UserSignupDTO,
  LoginDTO,
  StaffSetupDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  JwtPayload,
  MinimalUserInfo,
  TokenResult,
} from "./auth.types";

const IST = "Asia/Kolkata";
const MAX_SESSIONS = 5;

export class AuthService {

  static async signup(data: UserSignupDTO): Promise<TokenResult> {
    
    const existing = await AuthRepository.findUserByEmail(data.email);
    if (existing) throw new ConflictError(AUTH_MESSAGES.EMAIL_EXISTS);

    if (data.role === "CUSTOMER") {
      if (!data.username) {
        throw new BadRequestError("Username is required for customer accounts.");
      }
      const usernameTaken = await AuthRepository.checkUsernameExists(data.username.toLowerCase());
      if (usernameTaken) {
        throw new ConflictError("This username is already taken. Please choose another.");
      }
    }

    if (data.role === "OWNER" && !data.phone) {
      throw new BadRequestError("Phone number is required for business owner accounts.");
    }

    const passwordHash = await hashPassword(data.password);
    const user         = await AuthRepository.createUser(data.email, passwordHash, data.role);

    if (data.role === "CUSTOMER") {
      const customer = await AuthRepository.createCustomerProfile({
        userId:    user.id,
        username:  data.username!.toLowerCase(),
        name:      data.name,
        city:      data.city ?? "",
        state:     data.state ?? "",
        phone:     data.phone,
        avatarUrl: generateAvatarUrl(data.username!),
      });
      await AuthRepository.createCustomerWallet(customer.id);
    } else {
      await AuthRepository.createOwnerProfile({
        userId:     user.id,
        name:       data.name,
        city:       data.city ?? "",
        state:      data.state ?? "",
        phone:      data.phone!,
        avatar_url: generateAvatarUrl(data.name),
      });
    }

    await queueEmail({
      to:   user.email,
      type: "email-verification",
      data: { name: data.name },
    });

    const minimalUser = toMinimalUser({
      id: user.id, email: user.email, name: data.name, role: user.role as JwtPayload["role"],
    });

    return AuthService.issueTokens(user.id, user.role as JwtPayload["role"], user.version, minimalUser);
  }

  static async login(
    data: LoginDTO,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<TokenResult> {
    const user = await AuthRepository.findUserByEmail(data.email);
    if (!user) throw new UnauthorizedError(AUTH_MESSAGES.INVALID_CREDENTIALS);

    if (user.is_suspended) {
      throw new UnauthorizedError(
        "Your account has been suspended. Please contact support."
      );
    }

    switch (user.role) {
      case "STAFF": {
        if (!user.password_hash) {
          throw new UnauthorizedError(
            "Your account has not been set up yet. Check your invitation email."
          );
        }
        if (!user.is_active) {
          throw new UnauthorizedError("You are no longer associated with a business.");
        }
        const staff = await AuthRepository.findStaffByUserId(user.id);
        if (!staff?.is_active) {
          throw new UnauthorizedError("You are no longer associated with a business.");
        }
        break;
      }

      case "ADMIN": {
        const admin = await AuthRepository.findAdminByUserId(user.id);
        if (!admin?.is_active) {
          throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
        }
        break;
      }

      case "BUSINESS": {
        if (!user.is_active) {
          throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
        }
        const biz = await AuthRepository.findBusinessByAuthUserId(user.id);
        if (!biz) {
          throw new UnauthorizedError("This business account is not linked to a saloon.");
        }
        if (!biz.is_active) {
          throw new UnauthorizedError("This saloon account has been deactivated.");
        }
        // A35: check if the owner who owns this business is suspended
        if (biz.owner?.user?.is_suspended) {
          throw new UnauthorizedError(
            "Access to this business has been restricted. Please contact the platform."
          );
        }
        break;
      }

      default: {
        if (!user.is_active) {
          throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
        }
      }
    }

    const isValid = await verifyPassword(data.password, user.password_hash!);
    if (!isValid) throw new UnauthorizedError(AUTH_MESSAGES.INVALID_CREDENTIALS);


    const sessions = await AuthRepository.countActiveRefreshTokens(user.id);
    if (sessions >= MAX_SESSIONS) await AuthRepository.revokeAllUserTokens(user.id);

    await AuthRepository.updateLastLogin(user.id);

    if (user.role === "CUSTOMER") {
      const customer = await AuthRepository.findCustomerByUserId(user.id);
      if (customer) {
        await AuthRepository.setFirstLoginAtIfNull(customer.id);
      }
    }

    let displayName: string;
    let businessId: string | undefined;

    if (user.role === "BUSINESS") {
      const biz  = await AuthRepository.findBusinessByAuthUserId(user.id);
      businessId = biz!.id;
      displayName = biz!.business_name;
    } else {
      displayName = await AuthService.getNameByRole(user.id, user.role as JwtPayload["role"]);
    }

    const jwtPayload: JwtPayload = {
      userId: user.id,
      role:   user.role as JwtPayload["role"],
      version: user.version,
      businessId,
    };

    const minimalUser = toMinimalUser({
      id: user.id, email: user.email, name: displayName,
      role: user.role as JwtPayload["role"], businessId,
    });

    return AuthService.issueTokens(
      user.id, user.role as JwtPayload["role"], user.version, minimalUser, meta, jwtPayload
    );
  }

  static async staffSetup(
    data: StaffSetupDTO,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<TokenResult> {
    const hashedToken = hashToken(data.token);
    const record      = await AuthRepository.findStaffSetupToken(hashedToken);

    if (!record) {
      throw new UnauthorizedError("Setup link is invalid or has expired. Ask your employer to resend.");
    }

    const { user } = record;
    if (user.role !== "STAFF")  throw new BadRequestError("This setup link is not for a staff account.");
    if (user.password_hash)     throw new BadRequestError("Account is already set up. Please log in.");

    const staff = await AuthRepository.findStaffByUserId(user.id);
    if (!staff?.is_active) throw new UnauthorizedError("Your staff profile is no longer active.");

    const passwordHash = await hashPassword(data.newPassword);
    await AuthRepository.activateStaffAccount(user.id, passwordHash);
    await AuthRepository.markSetupTokenUsed(record.id);

    const minimalUser = toMinimalUser({ id: user.id, email: user.email, name: staff.name, role: "STAFF" });
    return AuthService.issueTokens(user.id, "STAFF", 1, minimalUser, meta);
  }

  static async refreshAccessToken(
    refreshToken: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = await AuthRepository.findRefreshToken(refreshToken);
    if (!stored)           throw new UnauthorizedError(AUTH_MESSAGES.TOKEN_EXPIRED);
    if (stored.is_revoked) throw new UnauthorizedError("Session revoked. Please log in again.");
    if (stored.expires_at < new Date()) throw new UnauthorizedError(AUTH_MESSAGES.TOKEN_EXPIRED);

    const payload = verifyRefreshToken(refreshToken);
    const user    = await AuthRepository.findUserById(payload.userId);
    if (!user)                            throw new UnauthorizedError("Account no longer exists.");
    if (user.version !== payload.version) throw new UnauthorizedError("Session expired. Please log in again.");

    if (user.is_suspended) {
      throw new UnauthorizedError("Your account has been suspended.");
    }

    await AuthRepository.revokeRefreshToken(refreshToken);

    let businessId: string | undefined;
    if (user.role === "BUSINESS") {
      const biz  = await AuthRepository.findBusinessByAuthUserId(user.id);
      businessId = biz?.id;
    }

    const newPayload: JwtPayload = { ...payload, businessId };
    const newAccess  = signAccessToken(newPayload);
    const newRefresh = signRefreshToken(newPayload);

    await AuthRepository.saveRefreshToken({
      userId:    payload.userId,
      token:     newRefresh,
      expiresAt: add(new Date(), { days: 7 }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken: newAccess, refreshToken: newRefresh };
  }

  static async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    try { await AuthRepository.revokeRefreshToken(refreshToken); } catch {}
  }

  static async forgotPassword(data: ForgotPasswordDTO): Promise<void> {
    const user = await AuthRepository.findUserByEmail(data.email);
    if (!user || !user.is_active || user.is_suspended) return;
    if (user.role === "STAFF" && !user.password_hash) return;

    const rawToken    = generateToken();
    const hashedToken = hashToken(rawToken);

    await AuthRepository.createPasswordResetToken({
      userId:    user.id,
      token:     hashedToken,
      expiresAt: add(new Date(), { hours: 1 }),
    });

    const name = user.role === "BUSINESS"
      ? (await AuthRepository.findBusinessByAuthUserId(user.id))?.business_name ?? "Business"
      : await AuthService.getNameByRole(user.id, user.role as JwtPayload["role"]);

    await queueEmail({
      to:   user.email,
      type: "password-reset",
      data: { name, resetCode: rawToken },
    });
  }

  static async resetPassword(data: ResetPasswordDTO): Promise<void> {
    const hashedToken = hashToken(data.token);
    const record      = await AuthRepository.findPasswordResetToken(hashedToken);
    if (!record) throw new UnauthorizedError("Reset link is invalid or has expired.");

    const passwordHash = await hashPassword(data.newPassword);
    await AuthRepository.updatePassword(record.user_id, passwordHash);
    await AuthRepository.incrementUserVersion(record.user_id);
    await AuthRepository.revokeAllUserTokens(record.user_id);
    await AuthRepository.markResetTokenUsed(record.id);
  }

  static async changePassword(userId: string, data: ChangePasswordDTO): Promise<void> {
    const user = await AuthRepository.findUserById(userId);
    if (!user) throw new NotFoundError("User not found.");
    if (!user.password_hash) throw new BadRequestError("No password is set on this account.");

    const isValid = await verifyPassword(data.currentPassword, user.password_hash);
    if (!isValid) throw new UnauthorizedError("Current password is incorrect.");

    const isSame = await verifyPassword(data.newPassword, user.password_hash);
    if (isSame) throw new BadRequestError("New password must differ from your current password.");

    const passwordHash = await hashPassword(data.newPassword);
    await AuthRepository.updatePassword(userId, passwordHash);
    await AuthRepository.incrementUserVersion(userId);
    await AuthRepository.revokeAllUserTokens(userId);

    queueEmail({
      to:   user.email,
      type: "change-password-confirmation",
      data: {
        name:      await AuthService.getNameByRole(userId, user.role as JwtPayload["role"]),
        changedAt: new Date().toISOString(),
      },
    }).catch(() => {});
  }

  static async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await AuthRepository.findUserById(userId);
    if (!user) throw new NotFoundError("User not found.");
    if (!user.password_hash) throw new BadRequestError("Account setup is incomplete.");

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) throw new UnauthorizedError("Incorrect password. Account deletion cancelled.");

    const name = await AuthService.getNameByRole(userId, user.role as JwtPayload["role"]);

    await AuthRepository.deleteUser(userId);

    queueEmail({
      to:   user.email,
      type: "account-deleted",
      data: { name },
    }).catch(() => {});
  }

  static async getNameByRole(userId: string, role: JwtPayload["role"]): Promise<string> {
    switch (role) {
      case "CUSTOMER": return (await AuthRepository.findCustomerByUserId(userId))?.name ?? "";
      case "OWNER":    return (await AuthRepository.findOwnerByUserId(userId))?.name    ?? "";
      case "STAFF":    return (await AuthRepository.findStaffByUserId(userId))?.name    ?? "";
      case "ADMIN":    return (await AuthRepository.findAdminByUserId(userId))?.name    ?? "";
      case "BUSINESS": return (await AuthRepository.findBusinessByAuthUserId(userId))?.business_name ?? "";
      default:         return "";
    }
  }

  private static async issueTokens(
    userId:   string,
    role:     JwtPayload["role"],
    version:  number,
    user:     MinimalUserInfo,
    meta:     { ipAddress?: string; userAgent?: string } = {},
    payload?: JwtPayload,
  ): Promise<TokenResult> {
    const jwtPayload: JwtPayload = payload ?? { userId, role, version };

    const accessToken  = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(jwtPayload);

    await AuthRepository.saveRefreshToken({
      userId,
      token:     refreshToken,
      expiresAt: add(new Date(), { days: 7 }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken, refreshToken, user };
  }
}