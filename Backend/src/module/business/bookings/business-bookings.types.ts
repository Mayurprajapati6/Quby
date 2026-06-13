export interface BusinessBookingFilters {
  status?:   "today" | "upcoming" | "past" | "all";
  staff_id?: string;
  page?:     number;
  limit?:    number;
}

export interface BusinessBookingListItemDTO {
  id:                   string;
  status:               string;
  service_start_time:       Date;
  arrival_window_start: Date;
  arrival_window_end:   Date;
  estimated_duration:   number | null;
  actual_duration:      number | null;
  amount:               number;
  queue_number:       number | null;
  notes:     string | null;
  customer: {
    id:         string;
    name:       string;
    avatar_url: string | null;
    phone:      string | null;
  };
  staff: {
    id:   string;
    name: string;
  };
  services: string[];
  created_at: Date;
}

export interface BusinessBookingDetailDTO extends BusinessBookingListItemDTO {
  idempotency_key:      string;
  checked_in_at:        Date | null;
  completed_at:         Date | null;
  cancelled_at:         Date | null;
  cancellation_reason:  string | null;
  qr_code?: {
    qr_image_url: string;
    expires_at:   Date;
    is_used:      boolean;
    scanned_at:   Date | null;
  } | null;
  transaction?: {
    status:              string;
    amount:              number;
    razorpay_payment_id: string | null;
    paid_at:             Date | null;
  } | null;
}
