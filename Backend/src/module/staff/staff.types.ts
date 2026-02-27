// ─── Response shape returned to client ───────────────────────────────────────
export interface StaffProfile {
  id:               string;
  userId:           string;
  email:            string;
  name:             string;
  phone:            string;
  avatar_url:       string;
  bio:              string | null;
  specialization:   string | null;
  experience_years: number | null;
  is_active:        boolean;
  is_verified:      boolean;
  average_rating:   number | null;
  total_reviews:    number;
  current_service_streak: number;
  longest_service_streak: number;
  business: {
    id:            string;
    name:          string;
    business_type: string;
    city:          string;
    state:         string;
  };
  services: StaffServiceItem[];
  schedule: StaffScheduleItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffServiceItem {
  id:               string;
  service_name:     string;
  duration_minutes: number;
  price:            number;
  is_available:     boolean;
}

export interface StaffScheduleItem {
  day_of_week:  string;
  is_available: boolean;
  start_time:   string | null;
  end_time:     string | null;
}

// ─── DTO: what staff can send in PATCH body ───────────────────────────────────
// Only these 3 fields. Phone, name, email, specialization blocked at Zod layer.
export interface UpdateStaffProfileDTO {
  avatar?:           string; // base64 image
  bio?:              string;
  experience_years?: number;
}

// ─── DTO: what repository writes to DB ───────────────────────────────────────
export interface UpdateStaffProfileRepoDTO {
  avatar_url?:       string;
  bio?:              string;
  experience_years?: number;
}