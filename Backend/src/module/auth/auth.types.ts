export interface JwtPayload {
  userId: string;
  role: 'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
  version: number; // Increments on password change — invalidates old tokens
}

export interface UserSignupDTO {
  name: string;
  email: string;
  password: string;
  city: string;
  state: string;
  phone?: string;
  role: 'CUSTOMER' | 'OWNER';
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface StaffSetupDTO {
  token: string;     
  newPassword: string;
}

export interface ForgotPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  token: string;
  newPassword: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountDTO {
  password: string;
}

export interface MinimalUserInfo {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  user: MinimalUserInfo;
}

export interface CreateCustomerProfileDTO {
  userId: string;
  name: string;
  city: string;
  state: string;
  phone?: string;
}

export interface CreateOwnerProfileDTO {
  userId: string;
  name: string;
  city: string;
  state: string;
  phone: string;
}

export interface SaveRefreshTokenDTO {
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreatePasswordResetTokenDTO {
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface CreateStaffSetupTokenDTO {
  userId: string;
  token: string;
  expiresAt: Date;
}