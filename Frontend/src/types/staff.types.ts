export interface StaffProfileDTO {
  id: string
  name: string
  email: string
  phone: string | null
  avatar_url: string | null
  bio: string | null
  specialization: string | null
  experience_years: number | null
  city: string | null
  state: string | null
  is_active: boolean
  is_verified: boolean
  average_rating: number
  total_reviews: number
  current_streak: number
  longest_streak: number
  join_date: string
  business: {
    id: string
    business_name: string
    logo_url: string | null
    owner_name: string | null
    owner_phone: string | null
    owner_avatar: string | null
  }
  services: Array<{
    id: string
    name: string
    category: string | null
    duration_minutes: number
    is_available: boolean
  }>
  schedule: Array<{
    day_of_week: string
    is_available: boolean
    start_time: string | null
    end_time: string | null
  }>
}

export interface StaffDashboardResponse {
  period: string
  staff: {
    id: string
    name: string
    avatar_url: string | null
    specialization: string | null
    experience_years: number | null
    average_rating: number
    total_reviews: number
    business_name: string
    current_streak: number
    longest_streak: number
  }
  today: {
    date: string
    total: number
    completed: number
    running: number
    upcoming: number
    current_booking: TodayBookingItem | null
    next_booking: TodayBookingItem | null
  }
  summary: {
    period_bookings: number
    completed: number
    cancelled: number
    revenue_inr: number
    accuracy_percent: number
  }
  month_performance: {
    on_time_count: number
    delayed_count: number
    on_time_percentage: number
    avg_delay_minutes: number
    average_efficiency: number
  }
  performance_timing: {
    _avg?: { estimated_duration: number | null; staff_taken_time: number | null }
    _count?: { id: number }
  }
  monthly_revenue: Array<{
    month: string
    year: number
    revenue_inr: number
    count: number
  }>
  top_services: Array<{
    name: string
    count: number
    revenue_inr: number
  }>
  pending: {
    leave_requests: number
    unread_notifications: number
  }
}

export interface TodayBookingItem {
  id: string
  booking_number: string
  queue_number: number
  status: string
  customer_name: string
  customer_avatar: string | null
  services: string[]
  arrival_window_end: string
  service_end_time: string
}

export interface QueueBooking {
  id: string
  booking_number: string
  queue_number: number
  status: string
  arrival_window_start: string
  arrival_window_end: string
  service_start_time: string
  service_end_time: string
  checked_in_at: string | null
  service_started_at: string | null
  estimated_duration: number
  services: string[]
  customer: {
    id: string
    name: string
    phone: string | null
    avatar_url: string | null
  }
  qr_code: {
    qr_code_id: string
    qr_image_url: string
    is_used: boolean
    expires_at: string
  } | null
}

export interface TodayQueueResponse {
  running: QueueBooking[]
  upcoming: QueueBooking[]
  staff_id: string
}

export interface StaffBookingListItem {
  id: string
  booking_number: string
  status: string
  service_date: string
  queue_number: number
  service_start_time: string
  estimated_duration: number
  services: string[]
  service_amount: number
  customer: {
    id: string
    name: string
    phone: string | null
    avatar_url: string | null
  }
  has_review: boolean
}

export interface StaffBookingDetail extends StaffBookingListItem {
  notes: string | null
  cancellation_reason: string | null
  arrival_window_start: string
  arrival_window_end: string
  service_end_time: string
  checked_in_at: string | null
  service_started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  actual_duration: number | null
  qr_code: {
    qr_image_url: string
    is_used: boolean
    used_at: string | null
    expires_at: string
  } | null
  payment: {
    status: string
    amount: number
    paid_at: string | null
    settled_at: string | null
  } | null
  review: {
    id: string
    rating: number
    comment: string | null
  } | null
}

export interface StaffLeaveItem {
  id: string
  leave_type: 'PERSONAL' | 'SICK' | 'EMERGENCY' | 'OTHER'
  start_date: string
  end_date: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
}

export interface StaffAttendanceDay {
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HOLIDAY' | 'NOT_MARKED' | 'HALF_DAY'
  source?: string
  booking_count?: number
  is_working_day?: boolean
}

export interface StaffMonthlyAttendance {
  month: string
  staff_name: string
  present_count: number
  absent_count: number
  leave_count: number
  holiday_count: number
  days: StaffAttendanceDay[]
}

export interface StaffHolidayItem {
  id: string
  holiday_name: string
  description: string | null
  start_date: string
  end_date: string
  applies_to_all_staff: boolean
  created_at: string
}

export interface StaffNotification {
  id: string
  type: string
  title: string
  message: string
  data: Record<string, unknown> | null
  action_url: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface StaffNotificationsResponse {
  notifications: StaffNotification[]
  unread_count: number
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface StaffReviewItem {
  id: string
  rating: number
  comment: string | null
  images: string[]
  business_response: string | null
  business_response_at: string | null
  created_at: string
  customer: {
    id: string
    name: string
    avatar_url: string | null
  }
  booking: {
    id: string
    booking_number: string
    service_date: string
    services: string[]
  }
}

export interface QrLogItem {
  qr_code_id: string
  used_at: string | null
  booking: {
    id: string
    booking_number: string
    service_date: string
    services: string[]
    customer: {
      id: string
      name: string
      avatar_url: string | null
    }
  }
}

export interface PerformanceSummary {
  total_bookings: number
  completed: number
  accuracy_percent: number
  avg_estimated_minutes: number
  avg_actual_minutes: number
  extra_time_taken_total_minutes: number
}
