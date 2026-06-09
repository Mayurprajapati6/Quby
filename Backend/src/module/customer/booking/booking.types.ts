export interface SuggestStaffDTO {
  business_id:          string;
  service_offering_ids: string[];
  service_date:         string;   
}

export interface SuggestedStaffItemDTO {
  staff_id:         string;
  staff_name:       string;
  avatar_url:       string | null;
  specialization:   string | null;
  experience_years: number | null;
  average_rating:   number;
  total_reviews:    number;
  status:           "FREE" | "BUSY" | "OFF";    
  services:         Array<{
    offering_id:      string;
    name:             string;
    duration_minutes: number;
  }>;
  total_duration_minutes: number;               
  estimated_service_start: string | null;       
  queue_position:          number;              
}

export interface PartialMatchStaffDTO {
  staff_id:   string;
  staff_name: string;
  avatar_url: string | null;
  can_do:     string[];   
  missing:    string[];   
}

export interface StaffSuggestionResponseDTO {
  can_fully_serve:    SuggestedStaffItemDTO[];   
  partial_matches:    PartialMatchStaffDTO[];    
  message:            string;                   
  total_duration_min: number;                   
  no_staff_reason?: 
  | "holiday"
  | "all_on_leave"
  | "no_matching_staff"
  | "all_fully_booked"
  | "not_scheduled"
  | "queue_overflow";
}

export interface CheckAvailabilityDTO {
  business_id:          string;
  service_offering_ids: string[];
  service_date:         string;   
  staff_id?:            string;   
  mode?:                "select" | "random";  
}

export interface SlotDTO {
  staff_id:             string;
  staff_name:           string;
  avatar_url:           string | null;
  service_start_time:   string;

arrival_window_start: string;

arrival_window_end: string;

scan_window_end: string;

estimated_duration: number;

queue_number: number;
}

export interface CheckAvailabilityResponseDTO {
  reservation_token:  string;
  expires_in:         number;
  service_date:       string;
  is_holiday:         boolean;
  is_business_closed: boolean;
  mode:               "select" | "random";
  auto_assigned?:     {
    staff_id:             string;
    staff_name:           string;
    staff_avatar_url?:    string | null;
    specialization?:      string | null;
    experience_years?:    number | null;
    avg_rating?:          number;
    total_reviews?:       number;
    estimated_duration?:  number;
    reason:               string;
  };
  slots:              SlotDTO[];
}

export interface CreateBookingDTO {
  reservation_token: string;
  selected_slot_idx: number;
  idempotency_key:   string;
  notes?:            string;
}

export interface CreateBookingResponseDTO {
  booking_id:            string;
  booking_number:        string;
  status:                string;
  service_amount:        number;
  expires_in:            number;
  is_idempotent:         boolean;
  razorpay_order_id?:    string | null;
  razorpay_key_id?:      string;
  queue_number?:         number;
  estimated_duration?:   number;
}

export interface CancelBookingDTO {
  cancellation_reason?: string;
}

export type BookingTab = "today" | "upcoming" | "completed" | "cancelled" | "no_show";

export interface BookingListItemDTO {
  id:                 string;
  booking_number:     string;
  business_name:      string;
  business_logo:      string | null;

  staff: {
    name: string;
    avatar_url: string | null;
  };

  service_date:       string;
  service_start_time: string;

  arrival_window_start: string;
  arrival_window_end: string;
  scan_window_end: string;
  service_end_time: string;

  status:             string;
  service_amount:     number;

  services: Array<{
    service_id: string;
    name: string;
    price: number;
    duration_minutes: number;
    image_url: string | null;
  }>;

  refund_status:      string | null;
  refund_amount:      number | null;
  cancellable_until:  string | null;
  is_cancellable:     boolean;
}

export interface BookingListResponseDTO {
  bookings:   BookingListItemDTO[];
  pagination: {
    total:       number;
    page:        number;
    limit:       number;
    total_pages: number;
  };
}

export interface BookingDetailDTO {
  id:                   string;
  booking_number:       string;
  status:               string;
  notes:                string | null;
  cancellation_reason:  string | null;
  cancelled_at:         string | null;

  service_amount:       number;
  cancellable_until:    string | null;
  is_cancellable:       boolean;

  service_started_at?: string | null;
checked_in_at?: string | null;
has_review?: boolean;

  service_date: string;

service_start_time: string;

arrival_window_start: string;

arrival_window_end: string;

scan_window_end: string;

service_end_time: string;

estimated_duration: number;
  total_duration:       number;
  queue_number:         number;

  actual_start_time?: string | null;
actual_end_time?: string | null;
actual_duration?: number | null;
delay_minutes?: number;

  qr_image_url:  string | null;
  qr_expires_at: string | null;

  business: {
    id:             string;
    business_name:  string;
    address_line1:  string;
    city:           string;
    state:          string;
    map_link:       string | null;
    business_phone: string | null;
    logo_url:       string | null;
  };

  staff: {
    id:         string;
    name:       string;
    avatar_url: string | null;
    phone:      string | null;
  };

  services: Array<{
    service_id:       string;
    name:             string;
    price:            number;
    duration_minutes: number;
    image_url:        string | null;
  }>;

  payment: {
    id:                  string;
    status:              string;
    razorpay_payment_id: string | null;
    paid_at:             string | null;
    refund_status:       string | null;
    refund_amount:       number | null;
  } | null;
}