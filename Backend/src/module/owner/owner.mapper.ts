import { OwnerProfile } from "./owner.types";

function generateDefaultAvatar(name: string): string {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=200`;
}

export const toOwnerProfile = (
  user: { email: string; is_active: boolean },
  owner: {
    id: string;
    name: string;
    phone: string;
    avatar_url: string | null;
    city: string;
    state: string;
    is_verified: boolean;
    total_businesses: number;
    active_businesses: number;
    total_staff: number;
    total_bookings: number;
    lifetime_earnings: number;
    created_at: Date;
    updated_at: Date;
  }
): OwnerProfile => ({
  id:                owner.id,
  email:             user.email,
  name:              owner.name,
  phone:             owner.phone,
  avatar_url:        owner.avatar_url ?? generateDefaultAvatar(owner.name),
  city:              owner.city,
  state:             owner.state,
  role:              "OWNER",
  is_active:         user.is_active,
  is_verified:       owner.is_verified,
  total_businesses:  owner.total_businesses,
  active_businesses: owner.active_businesses,
  total_staff:       owner.total_staff,
  total_bookings:    owner.total_bookings,
  lifetime_earnings: owner.lifetime_earnings,
  created_at:         owner.created_at,
  updated_at:         owner.updated_at,
});