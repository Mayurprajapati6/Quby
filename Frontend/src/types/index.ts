export type UserRole = 'CUSTOMER' | 'OWNER' | 'STAFF' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar_url?: string | null   
}

export type BookingStatus =
  | 'PENDING_PAYMENT' | 'CONFIRMED' | 'CHECKED_IN'
  | 'IN_PROGRESS' | 'RUNNING' | 'COMPLETED'
  | 'CANCELLED' | 'CANCELLED_NO_SHOW' | 'NO_SHOW' | 'EXPIRED'

export type LeaveType = 'SICK' | 'CASUAL' | 'EMERGENCY' | 'OTHER'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ReviewItemDTO {
  id: string;
  booking_id: string;
  business_id: string;
  staff_id: string;

  rating: number;
  comment?: string;
  images: string[];

  business_response?: string;
  business_response_at?: string;

  created_at: string;

  business_name: string;
  business_logo?: string;

  staff_name: string;
  staff_avatar?: string;

  services: {
    name: string;
    image_url: string | null;
  }[];
}

export interface PendingReviewItemDTO {
  booking_id: string; booking_number: string; business_id: string
  business_name: string; business_logo?: string
  staff_id: string; staff_name: string; staff_avatar?: string
  service_date: string; services: string[]
}

export interface BookingListItemDTO {
  id: string
  booking_number: string
  business_name: string
  business_logo: string | null
  
  staff: {
    name: string
    avatar_url: string | null
  }
  service_date: string
  service_start_time: string
  arrival_window_start: string
  arrival_window_end: string
  scan_window_end: string
  service_end_time: string
  created_at: Date | string
  status: string
  service_amount: number
  services: Array<{
    service_id: string
    name: string
    price: number
    duration_minutes: number
    image_url: string | null
  }>
  refund_status: string | null
  refund_amount: number | null
  cancellable_until: string | null
  is_cancellable: boolean
  
  service_started_at: string | null
  actual_start_time: string | null
  actual_end_time: string | null

  has_review: boolean
}

export interface BookingDetailDTO {
  id: string
  booking_number: string
  status: BookingStatus
 
  service_date: string
  service_start_time: string
  arrival_window_start: string
  arrival_window_end: string
 
  scan_window_end: string
  service_end_time: string
  estimated_duration: number
  queue_number: number
  total_duration: number
 
  qr_image_url: string | null
  qr_expires_at: string | null
 
  is_cancellable: boolean
  cancellable_until: string | null
 
  service_amount: number
 
  notes: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
 
  business: {
    id: string
    business_name: string
    address_line1: string
    city: string
    state: string
    map_link: string | null
    business_phone: string | null
    logo_url: string | null
  }
 
  staff: {
    id: string
    name: string
    avatar_url: string | null
    phone: string | null
  }
 
  services: Array<{
    service_id: string
    name: string
    price: number
    duration_minutes: number
    image_url?: string | null
  }>
 
  payment: {
    id: string
    status: string
    razorpay_payment_id: string | null
    paid_at: string | null
    refund_status: string | null
    refund_amount: number | null
  } | null
 
  service_started_at: string | null
  actual_start_time: string | null
  actual_end_time: string | null
  actual_duration: number | null
 
  checked_in_at: string | null
  has_review: boolean
 
  /** @deprecated use service_started_at instead */
  delay_minutes?: number
}

export interface CustomerWalletDTO {
  id: string; balance: number; currency: string
  lifetime_spent: number; lifetime_refunds: number
  total_bookings: number; completed_bookings: number; total_spent_inr: number
}

export interface CustomerWalletTransactionDTO {
  id: string; type: 'BOOKING_PAYMENT' | 'REFUND' | 'CREDIT'
  amount: number; balance_after: number; description: string
  booking_id?: string; created_at: string
  booking?: { booking_number: string; business_name: string }
}

export interface EarningsSummaryDTO {
  total_settled_inr?: number; total_pending_inr?: number; total_refunded_inr?: number
  settled_inr?: number; pending_inr?: number; refunded_inr?: number
  total_completed_bookings?: number
  businesses?: Array<{ business_id: string; business_name: string; logo_url?: string; settled_inr: number; pending_inr: number }>
}

export interface PaymentHistoryItemDTO {
  id: string; booking_number: string; customer_name?: string; staff_name?: string
  service_date: string; services: string[]; amount_inr: number
  status: 'PAID' | 'SETTLED' | 'REFUNDED'
  paid_at?: string; settled_at?: string; refund_status?: string; refund_amount_inr?: number
}

export interface OwnerReviewDTO {
  id: string; booking_number?: string; business_name?: string
  service_date?: string; services?: string[]
  rating: number; comment?: string; images: string[]
  customer_name?: string; customer_avatar?: string
  staff_id?: string; staff_name?: string; staff_avatar?: string
  business_response?: string; business_response_at?: string
  staff_response?: string; staff_response_at?: string
  is_verified?: boolean; created_at: string
}

export interface StaffReviewDTO {
  id: string; rating: number; comment?: string; images: string[]
  staff_response?: string; staff_response_at?: string
  business_response?: string; business_response_at?: string
  created_at: string
  customer: { id: string; name: string; avatar_url?: string }
  booking: { id: string; booking_number: string; service_date: string; services: string[] }
}

export interface LeaveItemDTO {
  id: string; staff_id?: string; staff_name?: string; staff_avatar?: string
  business_id?: string; business_name?: string
  leave_type: LeaveType; start_date: string; end_date: string
  reason?: string; status: LeaveStatus; rejection_reason?: string
  approved_at?: string; created_at: string
  has_booking_conflicts?: boolean; affected_bookings_count?: number
}

export interface AttendanceDayDTO {
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HOLIDAY' | 'NOT_MARKED' | 'HALF_DAY'
  source?: string; check_in_time?: string; notes?: string
}

export interface NotificationDTO {
  id: string; title: string; message?: string; type: string
  is_read: boolean; created_at: string; data?: Record<string, unknown>
}

// ── Matches backend CreateBookingResponseDTO exactly ──────────────
export interface CreateBookingResponseDTO {
  booking_id: string; booking_number: string; status: string
  service_amount: number
  expires_in: number; is_idempotent: boolean
  razorpay_order_id?: string | null
  razorpay_key_id?: string
  queue_number?: number
  arrival_window_start?: string
  arrival_window_end?: string
  service_end_time?: string
  estimated_duration?: number
}

export interface SlotDTO {
  staff_id: string; staff_name: string; avatar_url: string | null
  service_start_time: string; arrival_window_start: string; arrival_window_end: string
  estimated_duration: number; queue_number: number
}

export interface EscrowItemDTO {
  id: string; booking_number?: string; amount?: number; amount_inr?: number
  status: string; scheduled_release_at?: string; held_at?: string
}

// ── Schedule types matching backend ScheduleDayDTO / TodayScheduleDTO ──
export interface ScheduleDayDTO {
  day_of_week: string
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

export interface PublicBusinessProfileDTO {
  id: string; slug: string; business_name: string; owner_name: string
  service_for: string; description: string | null
  address_line1: string; address_line2: string | null; city: string; state: string
  pincode: string; map_link: string | null; business_phone: string | null; business_email: string | null
  website_url: string | null
  primary_image: string | null; logo_url: string | null
  gallery: Array<{ id: string; image_url: string; sort_order: number; is_primary: boolean }>
  average_rating: number; total_reviews: number
  is_open_now: boolean
  cancellation_window_hours: number
  schedules: ScheduleDayDTO[]
  todays_schedule: ScheduleDayDTO | null
  services: Array<{ id: string; name: string; service_for: string; image_url: string | null; price: number; discounted_price: number | null; is_featured: boolean }>
  staff: Array<{ id: string; name: string; avatar_url: string | null; specialization: string | null; experience_years: number | null; bio: string | null; average_rating: number; total_reviews: number; status: 'FREE' | 'BUSY' | 'OFF'; services: Array<{ offering_id: string; name: string; duration_minutes: number }> }>
  reviews: Array<{ 
  id: string;
  rating: number;
  comment: string | null;
  images: string[];

  services: {
    name: string;
    image_url: string | null;
  }[];

  business_response: string | null;
  business_response_at: string | null;

  created_at: string;

  customer: {
    name: string;
    avatar_url: string | null;
  };

  staff: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}>
  review_summary: { average_rating: number; total_reviews: number; rating_breakdown: { five: number; four: number; three: number; two: number; one: number } }
  social_links: { instagram: string | null; facebook: string | null; twitter: string | null; youtube: string | null; whatsapp: string | null }
  holidays?: Array<{ id: string; name?: string; holiday_name?: string; start_date: string; end_date: string }>
}

export type AvailabilityErrorReason =
  | 'on_leave'           
  | 'not_scheduled'      
  | 'queue_overflow'      
  | 'all_on_leave'       
  | 'all_fully_booked'   
  | 'holiday'            
  | 'no_slots'           
  | 'past_date'         

export interface AvailabilityErrorDTO {
  reason: AvailabilityErrorReason
  message: string
}

export interface StaffSuggestionResponseDTO {
  
  can_fully_serve: SuggestedStaffItemDTO[]
  
  partial_matches: PartialMatchStaffDTO[]
  
  message: string
  
  total_duration_min: number
  
  no_staff_reason?: 'holiday' | 'all_on_leave' | 'no_matching_staff' | 'not_scheduled' | 'all_fully_booked' | 'queue_overflow' | 'no_slots'
}

export interface SuggestedStaffItemDTO {
  staff_id: string
  staff_name: string
  avatar_url: string | null
  specialization: string | null
  experience_years: number | null
  average_rating: number
  total_reviews: number
  status: 'FREE' | 'BUSY' | 'OFF'
  services: Array<{ offering_id: string; name: string; duration_minutes: number }>
  total_duration_minutes: number
  estimated_service_start: string | null
  queue_position: number
}

export interface PartialMatchStaffDTO {
  staff_id: string
  staff_name: string
  avatar_url: string | null
  can_do: string[]
  missing: string[]
}

// ── Matches backend CheckAvailabilityResponseDTO exactly ──────────
export interface CheckAvailabilityResponseDTO {
  reservation_token: string; expires_in: number; service_date: string
  is_holiday: boolean; is_business_closed: boolean
  mode: 'select' | 'random'
  auto_assigned?: {
    staff_id: string; staff_name: string; staff_avatar_url?: string | null
    specialization?: string | null; experience_years?: number | null
    avg_rating?: number; total_reviews?: number
    arrival_window_start?: string; estimated_duration?: number
    reason: string
  }
  slots: SlotDTO[]
}

// ── Matches backend owner-dashboard.types.ts exactly ─────────────
export interface BusinessStatCardDTO {
  id: string
  business_name: string
  primary_image: string | null
  average_rating: number
  total_reviews: number
  total_bookings: number
  active_staff: number
  settled_earning_inr: number
  pending_earning_inr: number
}

export interface BestStaffDTO {
  id: string
  name: string
  avatar_url: string | null
  business_name: string
  average_rating: number
  total_reviews: number
  period_bookings: number
  period_earning_inr: number
}

export interface OwnerDashboardDTO {
  summary: {
  total_earnings_inr: number
  pending_earnings_inr: number

  no_show_earnings_inr: number
  completed_earnings_inr: number

  total_bookings: number
  completed_bookings: number
  refunded_bookings: number
  no_show_bookings: number
  upcoming_bookings: number
  today_bookings: number

  active_businesses: number
  total_businesses: number

  total_staff: number
  active_staff: number

  pending_leaves: number
}

  businesses: BusinessStatCardDTO[]
  best_staff: BestStaffDTO | null

  monthly_earnings: Array<{
    month: string
    year: number
    earning_inr: number
    booking_count: number
  }>

  top_services: Array<{
  name: string
  count: number
  revenue: number
  percentage: number
  image: string | null
}>

  business_chart: Array<{
    business_id: string
    business_name: string
    logo: string | null
    earning_inr: number
    percentage: number
  }>

  staff_chart: Array<{
    staff_id: string
    staff_name: string
    avatar: string | null
    bookings: number
    earning_inr: number
  }>

  daily_bookings: Array<{
    date: string
    bookings: number
  }>

  period: string
}

export type BookingTab = 'today' | 'upcoming' | 'completed' | 'cancelled' | 'no_show'

export interface BusinessCardDTO {
  id: string; slug: string; business_name: string; owner_name?: string
  service_for: string; city: string; state: string; address_line1: string
  primary_image?: string; average_rating: number; total_reviews: number
  opening_time?: string; closing_time?: string
  is_open_now: boolean; is_favourite: boolean; distance_km?: number
}

export interface FavouriteItemDTO {
  business_id: string; business_name: string; slug: string
  logo_url?: string; primary_image?: string
  city: string; state?: string; average_rating: number
  total_reviews?: number; service_for?: string
}

export type WalletTransactionDTO = CustomerWalletTransactionDTO

export interface CustomerDashboardDTO {
  customer: { id: string; name: string; avatar_url: string | null; username: string; city: string; state: string; join_date: string }
  stats: {
  total_bookings:     number;
  completed_bookings: number;
  cancelled_bookings: number;
  no_show_bookings:   number;

  upcoming_bookings:  number; 

  total_spent_inr:    number;
  refunded_inr:       number; 

  pending_reviews:    number;
  refunded_bookings: number;
}
  analytics: {
  booking_frequency: { month: number; count: number }[];

  booking_breakdown: {
    completed: number;
    cancelled: number;
    no_show: number;
    upcoming: number;
  };

  service_usage: {
    name: string;
    count: number;
    image: string | null;   
  }[];

  business_frequency: {
    name: string;
    count: number;
    logo: string | null;    
  }[];

  staff_frequency: {        
    name: string;
    count: number;
    avatar: string | null;
  }[];
};
  most_booked: {
    salon: { id: string | null; name: string; logo: string | null; count: number } | null
    staff: { id: string | null; name: string; logo: string | null; count: number } | null
    service: { id: string | null; name: string; logo: string | null; count: number } | null
  }
  monthly_spend: Array<{ month: number; year: number; label: string; amount_inr: number; bookings: number }>
  upcoming_booking: {
    id: string; booking_number: string; business_name: string; business_logo: string | null
    staff_name: string; staff_avatar: string | null
    service_date: string; service_start_time: string
    arrival_window_start: string; arrival_window_end: string
    services: string[]; status: string; qr_image_url: string | null
  } | null
  recent_bookings: Array<{
    id: string; booking_number: string; business_name: string
    business_logo: string | null; service_date: string
    service_start_time: string; status: string; has_review: boolean
  }>
  pending_reviews: PendingReviewItemDTO[]
  calendar_events: Array<{
  booking_id: string
  booking_number: string

  service_date: string
  service_start_time: string

  business_name: string
  business_logo: string | null
  business_city: string
  business_state: string

  staff_name: string
  staff_avatar: string | null

  services: string[]
  amount: number
  payment_status: string

  status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
}>
}

export interface BusinessDashboardDTO {
  summary: { total_earnings_inr: number; available_balance_inr?: number; total_bookings: number; completed_bookings: number; cancelled_bookings: number; today_bookings: number; average_rating: number; total_reviews: number; active_staff: number; total_staff: number; pending_leave_requests: number }
  staff_performance: Array<{ id: string; name: string; avatar_url?: string; average_rating: number; total_reviews: number; period_bookings: number; period_earning_inr: number; accuracy_percent: number; avg_taken_min: number; avg_estimated_min: number; avg_efficiency_pct: number; on_time_pct: number }>
  best_staff?: { id: string; name: string; avatar_url?: string; average_rating: number; period_bookings: number; period_earning_inr: number } | null
  top_services: Array<{ name: string; count: number; revenue_inr?: number; revenue?: number }>
  monthly_earnings: Array<{ month: string; year: number; earning_inr: number; booking_count: number }>
  period: string
}

export interface AdminDashboardDTO {
  users: {
    total_customers: number; total_owners: number; total_staff: number; total_admins: number
    new_today: number; new_this_week: number; new_this_month: number
  }
  businesses: {
    total: number; verified: number; pending_verification: number
    active: number; inactive: number; new_this_month: number
  }
  today: {
    date: string; total_bookings: number; completed: number
    cancelled: number; no_shows: number; platform_revenue: number; gross_bookings: number
  }
  revenue: {
    today: number; this_week: number; this_month: number; all_time: number
    refunds_this_month: number; net_this_month: number
  }
  top_businesses: Array<{ business_id: string; business_name: string; city: string; total_bookings: number; average_rating: number }>
  top_cities: Array<{ city: string; state: string; total_bookings: number; business_count: number }>
  pending: { verification_queue: number }
}

export interface PlatformServiceDTO {
  id: string; name: string; category?: string; service_for: string
  image_url?: string; is_active: boolean; created_at?: string
  description?: string
}

export interface QueueBookingDTO {
  id: string; booking_id?: string; booking_number: string; queue_number: number
  status: BookingStatus
  arrival_window_start: string; arrival_window_end: string
  service_start_time: string; service_end_time: string
  estimated_duration: number; checked_in_at?: string; services: string[]
  customer: { id: string; name: string; phone?: string; avatar_url?: string }
  staff?: { id: string; name: string; avatar_url?: string }
}

export interface StaffDashboardDTO {
  staff: { id: string; name: string; avatar_url?: string; specialization?: string; experience_years?: number; business_name: string; average_rating: number; total_reviews: number }
  today: { date: string; total_bookings: number; completed: number; in_progress: number; upcoming: number; cancelled: number; no_shows: number; current_booking?: TodayBookingItemDTO | null; next_booking?: TodayBookingItemDTO | null }
  month: { month: string; total_bookings: number; on_time_count: number; delayed_count: number; on_time_percentage: number; avg_delay_minutes: number; average_efficiency: number; revenue_inr?: number }
  streak: { current: number; longest: number }
  pending: { leave_requests: number; unread_notifications: number }
}

export interface TodayBookingItemDTO {
  booking_id: string; booking_number: string; queue_number: number
  customer_name: string; customer_avatar?: string; services: string[]
  arrival_window_end: string; service_end_time: string; status: BookingStatus
}

export interface StaffDetailDTO {
  id: string; name: string; email: string; phone?: string; avatar_url?: string
  bio?: string; specialization?: string; experience_years?: number
  business_name: string; is_active: boolean; setup_complete: boolean
  join_date: string; average_rating: number; total_reviews: number
  services: Array<{ id: string; name: string; category?: string; duration_minutes: number; is_available: boolean; price: number; discounted_price?: number }>
  schedule: Array<{ day_of_week: string; is_available: boolean; start_time?: string; end_time?: string }>
  stats: { period: string; total_bookings: number; completed_bookings: number; cancelled_bookings: number; no_show_bookings: number; revenue_inr: number; accuracy_percent: number; avg_rating: number; total_reviews: number; avg_taken_min: number; avg_estimated_min: number; avg_efficiency_pct: number; on_time_pct: number }
  recent_bookings: Array<{ id: string; booking_number: string; service_date: string; service_start_time: string; customer_name: string; services: string[]; status: string; amount: number }>
  recent_reviews: Array<{ id: string; customer_name: string; rating: number; comment?: string; service_date: string; created_at: string }>
}