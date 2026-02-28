export interface AdminProfile {
  id: string;
  userId: string;
  email: string;         
  name: string;
  avatar_url: string | null;
  role: 'ADMIN';
  is_active: boolean;
  permissions: any;
  created_at: Date;
  lastLoginAt: Date | null;
}

export interface UpdateAdminProfileDTO {
  name?: string;
}

export interface UpdateAdminProfileRepoDTO {
  name?: string;
}