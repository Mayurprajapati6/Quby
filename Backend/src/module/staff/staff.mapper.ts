import { StaffProfile, StaffServiceItem, StaffScheduleItem } from "./staff.types";

function generateDefaultAvatar(name: string): string {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=200`;
}

export const toStaffProfile = (
  user: { email: string },
  staff: {
    id:               string;
    user_id:          string;
    name:             string;
    phone:            string;
    avatar_url:       string | null;
    bio:              string | null;
    specialization:   string | null;
    experience_years: number | null;
    is_active:        boolean;
    is_verified:      boolean;
    average_rating:   number | null;
    total_reviews:    number;
    current_service_streak: number;
    longest_service_streak: number;
    created_at:       Date;
    updated_at:       Date;
    business: {
      id:            string;
      business_name: string;
      business_type: string;
      city:          string;
      state:         string;
    };
    services: Array<{
      id:               string;
      duration_minutes: number;
      is_available:     boolean;
      service_offering: {
        price: number;
        platform_service: { name: string };
      };
    }>;
    schedules: Array<{
      day_of_week:  string;
      is_available: boolean;
      start_time:   string | null;
      end_time:     string | null;
    }>;
  }
): StaffProfile => {

  const services: StaffServiceItem[] = staff.services.map((s) => ({
    id:               s.id,
    service_name:     s.service_offering.platform_service.name,
    duration_minutes: s.duration_minutes,
    price:            s.service_offering.price,
    is_available:     s.is_available,
  }));

  const schedule: StaffScheduleItem[] = staff.schedules.map((sc) => ({
    day_of_week:  sc.day_of_week,
    is_available: sc.is_available,
    start_time:   sc.start_time,
    end_time:     sc.end_time,
  }));

  return {
    id:               staff.id,
    userId:           staff.user_id,
    email:            user.email,
    name:             staff.name,
    phone:            staff.phone,
    avatar_url:       staff.avatar_url ?? generateDefaultAvatar(staff.name),
    bio:              staff.bio,
    specialization:   staff.specialization,
    experience_years: staff.experience_years,
    is_active:        staff.is_active,
    is_verified:      staff.is_verified,
    average_rating:   staff.average_rating,
    total_reviews:    staff.total_reviews,
    current_service_streak: staff.current_service_streak,
    longest_service_streak: staff.longest_service_streak,
    business: {
      id:            staff.business.id,
      name:          staff.business.business_name,
      business_type: staff.business.business_type,
      city:          staff.business.city,
      state:         staff.business.state,
    },
    services,
    schedule,
    createdAt: staff.created_at,
    updatedAt: staff.updated_at,
  };
};