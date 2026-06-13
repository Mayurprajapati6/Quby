export interface BusinessStaffListItemDTO {
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
}

export interface BusinessStaffDetailDTO extends BusinessStaffListItemDTO {
  bio:        string | null;
  join_date:  string;   

  services: Array<{
    id:               string;
    name:             string;
    category:         string | null;
    duration_minutes: number;
    is_available:     boolean;
  }>;

  schedule: Array<{
    day_of_week:  string;
    is_available: boolean;
    start_time:   string | null;
    end_time:     string | null;
  }>;

  stats: {
    total_bookings:     number;
    completed_bookings: number;
    cancelled_bookings: number;
    revenue_inr:        number;
    accuracy_percent:   number;
  };
}

export interface StaffLeaveDTO {
  id:               string;
  leave_type:       string;
  start_date:       string;
  end_date:         string;
  reason:           string;
  status:           string;
  rejection_reason: string | null;
  created_at:       string;
}

export interface StaffAttendanceDTO {
  id:             string;
  date:           string;
  status:         string;
  check_in_time:  string | null;
  source:         string;
}
