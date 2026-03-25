export interface StaffProfileDTO {
  id:               string;
  name:             string;
  email:            string;
  phone:            string;
  avatar_url:       string | null;
  bio:              string | null;
  specialization:   string | null;
  experience_years: number | null;
  is_active:        boolean;
  is_verified:      boolean;
  average_rating:   number;
  total_reviews:    number;
  current_streak:   number;
  longest_streak:   number;
  business: {
    id:            string;
    business_name: string;
    logo_url:      string | null;
  };
  services: Array<{
    id:                  string;
    service_offering_id: string;
    service_name:        string;
    duration_minutes:    number;
    is_available:        boolean;
  }>;
  schedules: Array<{
    id:           string;
    day_of_week:  string;
    is_available: boolean;
    start_time:   string | null;
    end_time:     string | null;
  }>;
  created_at: Date;
}

export interface UpdateStaffProfileDTO {
  name?:             string;
  phone?:            string;
  bio?:              string;
  specialization?:   string;
  experience_years?: number;
}
