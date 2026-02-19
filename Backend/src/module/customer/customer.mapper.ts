import { CustomerProfile } from "./customer.types";

function generateDefaultAvatar(name: string): string {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=200`;
}

export const toCustomerProfile = (
  user: { email: string; is_active: boolean; is_verified: boolean },
  customer: {
    id: string;
    name: string;
    phone: string | null;
    avatar_url: string | null;
    gender: string | null;
    city: string;
    state: string;
    total_bookings: number;
    completed_bookings: number;
    cancelled_bookings: number;
    current_streak: number;
    total_spent: number;
    created_at: Date;
    updated_at: Date;
  }
): CustomerProfile => ({
  id:                customer.id,
  email:             user.email,
  name:              customer.name,
  phone:             customer.phone,
  avatar_url:        customer.avatar_url ?? generateDefaultAvatar(customer.name),
  gender:            customer.gender,
  city:              customer.city,
  state:             customer.state,
  role:              "CUSTOMER",
  is_active:         user.is_active,
  is_verified:       user.is_verified,
  total_bookings:    customer.total_bookings,
  completed_bookings: customer.completed_bookings,
  cancelled_bookings: customer.cancelled_bookings,
  current_streak:    customer.current_streak,
  total_spent:       customer.total_spent,
  createdAt:         customer.created_at,
  updatedAt:         customer.updated_at,
});