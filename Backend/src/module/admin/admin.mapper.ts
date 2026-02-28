import { AdminProfile } from "./admin.types";

export const toAdminProfile = (
  user: { email: string; last_login_at: Date | null },
  admin: {
    id: string;
    user_id: string;
    name: string;
    avatar_url: string | null;
    is_active: boolean;
    permissions: any;
    created_at: Date;
  }
): AdminProfile => ({
  id:          admin.id,
  userId:      admin.user_id,
  email:       user.email,
  name:        admin.name,
  avatar_url:  admin.avatar_url,
  role:        'ADMIN',
  is_active:   admin.is_active,
  permissions: admin.permissions,
  created_at:   admin.created_at,
  lastLoginAt: user.last_login_at,
});