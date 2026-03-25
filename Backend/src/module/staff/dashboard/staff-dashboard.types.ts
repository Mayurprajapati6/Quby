export interface StaffDashboardDTO {
  staff: {
    id:              string;
    name:            string;
    avatar_url:      string | null;
    specialization:  string | null;
    experience_years: number | null;
    business_name:   string;
    average_rating:  number;
    total_reviews:   number;
  };

  today: {
    date:             string;   
    total_bookings:   number;
    completed:        number;
    in_progress:      number;
    upcoming:         number;
    cancelled:        number;
    no_shows:         number;
    current_booking:  TodayBookingItemDTO | null;
    next_booking:     TodayBookingItemDTO | null;
  };

  month: {
    month:              string;   
    total_bookings:     number;
    on_time_count:      number;
    delayed_count:      number;
    on_time_percentage: number;   
    avg_delay_minutes:  number;
    average_efficiency: number;   
  };

  streak: {
    current:  number;
    longest:  number;
  };

  pending: {
    leave_requests:        number;   
    unread_notifications:  number;
  };
}

export interface TodayBookingItemDTO {
  booking_id:         string;
  booking_number:     string;
  queue_number:       number;
  customer_name:      string;
  customer_avatar:    string | null;
  services:           string[];
  arrival_window_end: Date;
  service_end_time:   Date;
  status:             string;
}
