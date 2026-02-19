export interface CustomerProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar_url: string;
  gender: string | null;
  city: string;
  state: string;
  role: 'CUSTOMER';
  is_active: boolean;
  is_verified: boolean;
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  current_streak: number;
  total_spent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCustomerProfileDTO {
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  gender?: string;
  avatar?: string; 
}

export interface UpdateCustomerProfileRepoDTO {
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  gender?: string;
  avatar_url?: string;
}