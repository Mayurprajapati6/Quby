// ─────────────────────────────────────────────────────────────────────────────
// FILE   : owner/staff-detail/staff-detail.types.ts
// A42    : Complete — owner's view of a single staff member (full detail page)
// ─────────────────────────────────────────────────────────────────────────────

export interface StaffDetailDTO {
  // Personal info
  id:               string;
  name:             string;
  email:            string;
  phone:            string | null;
  avatar_url:       string | null;
  bio:              string | null;
  specialization:   string | null;
  experience_years: number | null;
  business_name:    string;
  is_active:        boolean;
  setup_complete:   boolean;
  join_date:        string;    // IST YYYY-MM-DD
  average_rating:   number;
  total_reviews:    number;

  // Services offered by this staff (with per-staff duration)
  services: Array<{
    id:               string;
    name:             string;
    category:         string | null;
    duration_minutes: number;
    is_available:     boolean;
    price:            number;
    discounted_price: number | null;
  }>;

  // Weekly schedule
  schedule: Array<{
    day_of_week:  string;
    is_available: boolean;
    start_time:   string | null;
    end_time:     string | null;
  }>;

  // Period-filtered stats (month/week/year)
  stats: StaffPeriodStatsDTO;

  // Recent bookings (latest 10)
  recent_bookings: Array<{
    id:             string;
    booking_number: string;
    service_date:   string;
    service_start_time: string;
    customer_name:  string;
    services:       string[];
    status:         string;
    amount:         number;
  }>;

  // Recent reviews (latest 5)
  recent_reviews: Array<{
    id:             string;
    customer_name:  string;
    staff_rating:   number;
    staff_comment:  string | null;
    service_date:   string;
    created_at:     string;
  }>;
}

export interface StaffPeriodStatsDTO {
  period:              string;
  total_bookings:      number;
  completed_bookings:  number;
  cancelled_bookings:  number;
  no_show_bookings:    number;
  revenue_inr:         number;
  accuracy_percent:    number;
  avg_rating:          number;
  total_reviews:       number;
  // Timing performance
  avg_taken_min:       number;   // average actual time staff spent per service
  avg_estimated_min:   number;   // average slot duration
  avg_efficiency_pct:  number;   // estimated/actual × 100 (higher = faster)
  on_time_pct:         number;   // % services completed within slot duration + 5 min grace
}