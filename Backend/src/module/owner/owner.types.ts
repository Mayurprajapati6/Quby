export interface OwnerProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar_url: string;
  city: string;
  state: string;
  role: 'OWNER';
  is_active: boolean;
  is_verified: boolean;
  total_businesses: number;
  active_businesses: number;
  total_staff: number;
  total_bookings: number;
  lifetime_earnings: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateOwnerProfileDTO {
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  avatar?: string;
}

export interface UpdateOwnerProfileRepoDTO {
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  avatar_url?: string;
}