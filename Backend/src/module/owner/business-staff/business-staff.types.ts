export interface StaffListItemDTO {
  id:               string;
  name:             string;
  email:            string;
  phone:            string | null;
  avatar_url:       string | null;
  specialization:   string | null;
  experience_years: number | null;
  is_active:        boolean;
  setup_complete:   boolean;           
  average_rating:   number;
  total_reviews:    number;
  today_bookings:   number;
  business_name:    string;            
}

export interface CreateStaffDTO {
  name:              string;
  email:             string;
  phone:             string;
  specialization?:   string;
  experience_years?: number;
  bio?:              string;
  services?: Array<{
    service_offering_id: string;
    duration_minutes:    number;
    is_available?:       boolean;
  }>;
  schedule?: Array<{
    day_of_week:  string;
    is_available: boolean;
    start_time?:  string;
    end_time?:    string;
  }>;
}

export interface UpdateStaffDTO {
  name?:             string;
  phone?:            string;
  specialization?:   string;
  experience_years?: number;
  bio?:              string;
}

export interface UpdateStaffServicesDTO {
  services: Array<{
    service_offering_id: string;
    duration_minutes:    number;
    is_available?:       boolean;
  }>;
}

export interface UpdateStaffScheduleDTO {
  schedule: Array<{
    day_of_week:  string;
    is_available: boolean;
    start_time?:  string;
    end_time?:    string;
  }>;
}
