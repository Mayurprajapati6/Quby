export interface CustomerDashboardDTO {
  customer: {
    id:         string;
    name:       string;
    avatar_url: string | null;
    username:   string;
    city:       string;
    state:      string;
    join_date:  string;
  };

  stats: {
    total_bookings:     number;
    completed_bookings: number;
    cancelled_bookings: number;
    no_show_bookings:   number;
    total_spent_inr:    number;
    total_favourites:   number;
    pending_reviews:    number;
  };

  most_booked: {
    salon:   MostBookedItem | null;
    staff:   MostBookedItem | null;
    service: MostBookedItem | null;
  };

  monthly_spend: MonthlySpendDTO[];

  upcoming_booking: UpcomingBookingDTO | null;

  recent_bookings: RecentBookingDTO[];

  pending_reviews: PendingReviewDTO[];

  calendar_events: CalendarEventDTO[];
}

export interface MostBookedItem {
  id:    string | null;
  name:  string;
  logo:  string | null;
  count: number;
}

export interface MonthlySpendDTO {
  month:       number;   
  year:        number;
  label:       string;   
  amount_inr:  number;  
  bookings:    number;
}

export interface UpcomingBookingDTO {
  id:                   string;
  booking_number:       string;
  business_name:        string;
  business_logo:        string | null;
  staff_name:           string;
  staff_avatar:         string | null;
  service_date:         string;   
  service_start_time:   string;   
  arrival_window_start: string;
  arrival_window_end:   string;
  services:             string[];
  status:               string;
  qr_image_url:         string | null;
}

export interface RecentBookingDTO {
  id:             string;
  booking_number: string;
  business_name:  string;
  business_logo:  string | null;
  service_date:   string;
  service_start_time: string;
  status:         string;
  total_amount:   number;
  has_review:     boolean;
}

export interface PendingReviewDTO {
  booking_id:     string;
  booking_number: string;
  business_id:    string;
  business_name:  string;
  staff_id:       string;
  staff_name:     string;
  service_date:   string;
}

export interface CalendarEventDTO {
  booking_id:     string;
  booking_number: string;
  service_date:   string;   
  service_start_time: string;   
  business_name:  string;
  staff_name:     string;
  status:         string;
}

export interface DashboardFilters {
  month?: number;   
  year?:  number;   
}
