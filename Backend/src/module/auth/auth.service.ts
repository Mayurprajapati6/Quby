// ─────────────────────────────────────────────────────────────────────────────
// MODULE: auth
// FILE:   auth.service.ts
// CHANGE: login() handles BUSINESS role — fetches businessId, adds to JWT
//         Staff 48hr token expiry — schedules auto-reinvitation job
// ─────────────────────────────────────────────────────────────────────────────

import { add }             from 'date-fns';
import { AuthRepository }  from './auth.repository';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
} from '../../utils/helpers/crypto';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/helpers/jwt';
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../utils/errors/app.error';
import { toMinimalUser }   from './auth.mapper';
import {
  UserSignupDTO,
  LoginDTO,
  StaffSetupDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  JwtPayload,
  MinimalUserInfo,
  TokenResult,
} from './auth.types';
import { AUTH_MESSAGES }   from '../../constants/messages';
import { queueEmail }      from '../../services/email.services';

const MAX_SESSIONS = 5;

export class AuthService {

  static async signup(data: UserSignupDTO): Promise<TokenResult> {
    const existingUser = await AuthRepository.findUserByEmail(data.email);
    if (existingUser) throw new ConflictError(AUTH_MESSAGES.EMAIL_EXISTS);

    if (data.role === 'OWNER' && !data.phone) {
      throw new BadRequestError('Phone number is required for business owner accounts.');
    }

    const hashedPassword = await hashPassword(data.password);
    const user           = await AuthRepository.createUser(data.email, hashedPassword, data.role);

    if (data.role === 'CUSTOMER') {
      const customer = await AuthRepository.createCustomerProfile({
        userId: user.id, name: data.name, city: data.city, state: data.state, phone: data.phone,
      });
      await AuthRepository.createCustomerWallet(customer.id);
    } else {
      await AuthRepository.createOwnerProfile({
        userId: user.id, name: data.name, city: data.city, state: data.state, phone: data.phone!,
      });
    }

    return AuthService.issueTokens(
      user.id,
      user.role as JwtPayload['role'],
      user.version,
      toMinimalUser({ id: user.id, email: user.email, name: data.name, role: user.role as JwtPayload['role'] })
    );
  }

  static async login(
    data: LoginDTO,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<TokenResult> {
    const user = await AuthRepository.findUserByEmail(data.email);
    if (!user) throw new UnauthorizedError(AUTH_MESSAGES.INVALID_CREDENTIALS);

    switch (user.role) {

      case 'STAFF': {
        if (!user.password_hash) {
          throw new UnauthorizedError(
            'Your account has not been set up yet. Please check your email for the invitation link.'
          );
        }
        if (!user.is_active) {
          throw new UnauthorizedError(
            'You are no longer associated with a business. Please contact your employer.'
          );
        }
        const staff = await AuthRepository.findStaffByUserId(user.id);
        if (!staff?.is_active) {
          throw new UnauthorizedError(
            'You are no longer associated with a business. Please contact your employer.'
          );
        }
        break;
      }

      case 'ADMIN': {
        const admin = await AuthRepository.findAdminByUserId(user.id);
        if (!admin?.is_active) throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
        break;
      }

      case 'BUSINESS': {
        if (!user.is_active) throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);

        const business = await AuthRepository.findBusinessByAuthUserId(user.id);
        if (!business) {
          throw new UnauthorizedError('This business account is no longer linked to any saloon.');
        }
        if (!business.is_active) {
          throw new UnauthorizedError('This saloon account has been deactivated. Contact your owner.');
        }
        break;
      }

      default: {
        if (!user.is_active) throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
      }
    }

    const isValid = await verifyPassword(data.password, user.password_hash!);
    if (!isValid) throw new UnauthorizedError(AUTH_MESSAGES.INVALID_CREDENTIALS);

    const activeSessions = await AuthRepository.countActiveRefreshTokens(user.id);
    if (activeSessions >= MAX_SESSIONS) {
      await AuthRepository.revokeAllUserTokens(user.id);
    }

    await AuthRepository.updateLastLogin(user.id);

   
    let businessId: string | undefined;
    let displayName: string;

    if (user.role === 'BUSINESS') {
      const business = await AuthRepository.findBusinessByAuthUserId(user.id);
      businessId  = business!.id;
      displayName = business!.business_name;
    } else {
      displayName = await AuthService.getNameByRole(user.id, user.role as JwtPayload['role']);
    }

    const payload: JwtPayload = {
      userId:     user.id,
      role:       user.role as JwtPayload['role'],
      version:    user.version,
      businessId,   
    };

    return AuthService.issueTokens(
      user.id,
      user.role as JwtPayload['role'],
      user.version,
      toMinimalUser({
        id:         user.id,
        email:      user.email,
        name:       displayName,
        role:       user.role as JwtPayload['role'],
        businessId,
      }),
      meta,
      payload
    );
  }

  static async staffSetup(
    data: StaffSetupDTO,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<TokenResult> {
    const hashedToken  = hashToken(data.token);
    const setupRecord  = await AuthRepository.findStaffSetupToken(hashedToken);

    if (!setupRecord) {
      throw new UnauthorizedError(
        'This setup link is invalid or has expired. Please ask your employer to resend the invitation.'
      );
    }

    const { user } = setupRecord;

    if (user.role !== 'STAFF') {
      throw new ForbiddenError('This setup link is not valid for your account type.');
    }

    if (user.password_hash) {
      throw new BadRequestError(
        'Your account is already set up. Please login normally. If you forgot your password, use Forgot Password.'
      );
    }

    const staff = await AuthRepository.findStaffByUserId(user.id);
    if (!staff?.is_active) {
      throw new UnauthorizedError(
        'Your staff profile is no longer active. Please contact your employer.'
      );
    }

    const hashedPassword = await hashPassword(data.newPassword);
    await AuthRepository.activateStaffAccount(user.id, hashedPassword);
    await AuthRepository.markSetupTokenUsed(setupRecord.id);

    return AuthService.issueTokens(
      user.id,
      'STAFF',
      1,
      toMinimalUser({ id: user.id, email: user.email, name: staff.name, role: 'STAFF' }),
      meta
    );
  }

  static async refreshAccessToken(
    refreshToken: string,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = await AuthRepository.findRefreshToken(refreshToken);

    if (!stored)          throw new UnauthorizedError(AUTH_MESSAGES.TOKEN_EXPIRED);
    if (stored.is_revoked) throw new UnauthorizedError('Session has been revoked. Please login again.');
    if (stored.expires_at < new Date()) throw new UnauthorizedError(AUTH_MESSAGES.TOKEN_EXPIRED);

    const payload = verifyRefreshToken(refreshToken);
    const user    = await AuthRepository.findUserById(payload.userId);

    if (!user)                        throw new UnauthorizedError('Account no longer exists.');
    if (user.version !== payload.version) throw new UnauthorizedError('Session expired due to a security change. Please login again.');

    switch (user.role) {
      case 'STAFF': {
        if (!user.is_active) {
          await AuthRepository.revokeRefreshToken(refreshToken);
          throw new UnauthorizedError('You are no longer associated with a business.');
        }
        const staff = await AuthRepository.findStaffByUserId(user.id);
        if (!staff?.is_active) {
          await AuthRepository.revokeRefreshToken(refreshToken);
          throw new UnauthorizedError('You are no longer associated with a business.');
        }
        break;
      }
      case 'ADMIN': {
        const admin = await AuthRepository.findAdminByUserId(user.id);
        if (!admin?.is_active) {
          await AuthRepository.revokeRefreshToken(refreshToken);
          throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
        }
        break;
      }
      case 'BUSINESS': {
        const business = await AuthRepository.findBusinessByAuthUserId(user.id);
        if (!business?.is_active) {
          await AuthRepository.revokeRefreshToken(refreshToken);
          throw new UnauthorizedError('This saloon account has been deactivated.');
        }
        break;
      }
      default: {
        if (!user.is_active) {
          await AuthRepository.revokeRefreshToken(refreshToken);
          throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
        }
      }
    }

    await AuthRepository.revokeRefreshToken(refreshToken);

    let businessId: string | undefined;
    if (user.role === 'BUSINESS') {
      const business = await AuthRepository.findBusinessByAuthUserId(user.id);
      businessId = business?.id;
    }

    const newPayload: JwtPayload = { ...payload, businessId };
    const newAccessToken  = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    await AuthRepository.saveRefreshToken({
      userId:    payload.userId,
      token:     newRefreshToken,
      expiresAt: add(new Date(), { days: 7 }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  static async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    try { await AuthRepository.revokeRefreshToken(refreshToken); } catch {}
  }

  static async logoutAllDevices(userId: string): Promise<void> {
    await AuthRepository.revokeAllUserTokens(userId);
    await AuthRepository.incrementUserVersion(userId);
  }

  static async forgotPassword(data: ForgotPasswordDTO): Promise<void> {
    const user = await AuthRepository.findUserByEmail(data.email);
    if (!user)                              return;
    if (user.role === 'STAFF' && !user.password_hash) return;
    if (!user.is_active)                    return;

    const rawToken    = generateToken();
    const hashedToken = hashToken(rawToken);

    await AuthRepository.createPasswordResetToken({
      userId:    user.id,
      token:     hashedToken,
      expiresAt: add(new Date(), { hours: 1 }),
    });

    const name = user.role === 'BUSINESS'
      ? (await AuthRepository.findBusinessByAuthUserId(user.id))?.business_name ?? 'Business'
      : await AuthService.getNameByRole(user.id, user.role as JwtPayload['role']);

    await queueEmail({
      to:   user.email,
      type: 'password-reset',
      data: { name, resetCode: rawToken },
    });
  }

  static async resetPassword(data: ResetPasswordDTO): Promise<void> {
    const hashedToken  = hashToken(data.token);
    const resetRecord  = await AuthRepository.findPasswordResetToken(hashedToken);

    if (!resetRecord) {
      throw new UnauthorizedError('This reset link is invalid or has expired. Please request a new one.');
    }

    const hashedPassword = await hashPassword(data.newPassword);
    await AuthRepository.updatePassword(resetRecord.user_id, hashedPassword);
    await AuthRepository.incrementUserVersion(resetRecord.user_id);
    await AuthRepository.revokeAllUserTokens(resetRecord.user_id);
    await AuthRepository.markResetTokenUsed(resetRecord.id);
  }

  static async changePassword(userId: string, data: ChangePasswordDTO): Promise<void> {
    const user = await AuthRepository.findUserById(userId);
    if (!user) throw new NotFoundError('User not found.');

    if (!user.password_hash) {
      throw new BadRequestError('No password set on this account.');
    }

    const isValid = await verifyPassword(data.currentPassword, user.password_hash);
    if (!isValid) throw new UnauthorizedError('Current password is incorrect.');

    const isSame = await verifyPassword(data.newPassword, user.password_hash);
    if (isSame)  throw new BadRequestError('New password must be different from your current password.');

    const hashedPassword = await hashPassword(data.newPassword);
    await AuthRepository.updatePassword(userId, hashedPassword);
    await AuthRepository.incrementUserVersion(userId);
    await AuthRepository.revokeAllUserTokens(userId);
  }

  static async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await AuthRepository.findUserById(userId);
    if (!user) throw new NotFoundError('User not found.');

    if (!user.password_hash) {
      throw new BadRequestError('Account setup is incomplete. Cannot delete account.');
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) throw new UnauthorizedError('Incorrect password. Account deletion cancelled.');

    await AuthRepository.deleteUser(userId);
  }

  static async getNameByRole(userId: string, role: JwtPayload['role']): Promise<string> {
    switch (role) {
      case 'CUSTOMER': return (await AuthRepository.findCustomerByUserId(userId))?.name ?? '';
      case 'OWNER':    return (await AuthRepository.findOwnerByUserId(userId))?.name ?? '';
      case 'STAFF':    return (await AuthRepository.findStaffByUserId(userId))?.name ?? '';
      case 'ADMIN':    return (await AuthRepository.findAdminByUserId(userId))?.name ?? '';
      case 'BUSINESS': return (await AuthRepository.findBusinessByAuthUserId(userId))?.business_name ?? '';
      default:         return '';
    }
  }

  private static async issueTokens(
    userId:    string,
    role:      JwtPayload['role'],
    version:   number,
    user:      MinimalUserInfo,
    meta?:     { ipAddress?: string; userAgent?: string },
    payload?:  JwtPayload  
  ): Promise<TokenResult> {
    const jwtPayload: JwtPayload = payload ?? { userId, role, version };

    const accessToken  = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(jwtPayload);

    await AuthRepository.saveRefreshToken({
      userId,
      token:     refreshToken,
      expiresAt: add(new Date(), { days: 7 }),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { accessToken, refreshToken, user };
  }
}