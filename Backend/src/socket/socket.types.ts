export interface SocketData {
  userId:      string;
  role:        "CUSTOMER" | "STAFF" | "OWNER" | "BUSINESS" | "ADMIN";
  entityId:    string;
  businessId?: string;
}

export interface ServerToClientEvents {

  "booking:confirmed":    (p: BookingConfirmedPayload)   => void;
  "booking:cancelled":    (p: BookingCancelledPayload)   => void;
  "booking:no_show":      (p: BookingNoShowPayload)      => void;
  "booking:timeout":      (p: BookingTimeoutPayload)     => void;
  "booking:reminder":     (p: BookingReminderPayload)    => void;

  "booking:expired":      (p: BookingExpiredPayload)     => void;

  "service:checked_in":   (p: ServiceCheckedInPayload)   => void;
  "service:completed":    (p: ServiceCompletedPayload)   => void;
  "service:delayed":      (p: ServiceDelayedPayload)     => void;

  "queue:updated":        (p: QueueUpdatedPayload)       => void;

  
  "payment:confirmed":    (p: PaymentConfirmedPayload)   => void;
  "payment:received":     (p: PaymentReceivedPayload)    => void;

  "payment:failed":       (p: PaymentFailedPayload)      => void;

  "escrow:released":      (p: EscrowReleasedPayload)     => void;

  "business:submitted":   (p: BusinessSubmittedPayload)  => void;
  "business:approved":    (p: BusinessApprovedPayload)   => void;
  "business:rejected":    (p: BusinessRejectedPayload)   => void;

  "staff:leave_requested": (p: LeaveRequestedPayload)    => void;
  "staff:leave_approved":  (p: LeaveApprovedPayload)     => void;
  "staff:leave_rejected":  (p: LeaveRejectedPayload)     => void;

  "holiday:update":       (p: HolidayUpdatePayload)      => void;
  "notification:new":     (p: NewNotificationPayload)    => void;
  "booking:created":      (p: { bookingId: string; bookingNumber?: string; amount?: number }) => void;
  "booking:new":          (p: { bookingId: string; customerName?: string })                   => void;
  "account:suspended":    (p: { reason?: string })                                            => void;
  "business:verified":    (p: { businessId: string; businessName: string })                  => void;

  "booking:updated":      (p: any)                       => void;
  "booking:time_updated": (p: any)                       => void;
  "service:started":      (p: any)                       => void;
  "service:overdue":      (p: any)                       => void;
  "queue:shifted":        (p: any)                       => void;
  "queue:extended":       (p: any)                       => void;

  "QUEUE_UPDATED":     (p: QueueUpdatedPayload)     => void;
  "BOOKING_STARTED":   (p: ServiceCheckedInPayload) => void;
  "BOOKING_COMPLETED": (p: ServiceCompletedPayload) => void;
  "BOOKING_CANCELLED": (p: BookingCancelledPayload) => void;
}

export interface ClientToServerEvents {
  "join:business":  (businessId: string) => void;
  "leave:business": (businessId: string) => void;
  "ping":           () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface BookingConfirmedPayload {
  bookingId:     string;
  bookingNumber: string;
  customerName:  string;
  businessName:  string;
  serviceDate:   string;
  queueNumber:   number;
  qrImageUrl:    string;
  staffName?:    string;
}

export interface BookingCancelledPayload {
  bookingId:     string;
  bookingNumber: string;
  refunded:      boolean;
  refundAmount:  number;
  reason?:       string;
}

export interface BookingNoShowPayload {
  bookingId:      string;
  bookingNumber?: string;
  customerName?:  string;
  staffName?:     string;
}

export interface BookingTimeoutPayload {
  bookingId: string;
}

export interface BookingExpiredPayload {
  bookingId: string;
  message:   string;
}

export interface BookingReminderPayload {
  bookingId: string;
  type:      "reminder-1hr" | "reminder-15min";
}

export interface ServiceCheckedInPayload {
  bookingId:    string;
  customerName: string;
  staffId:      string;
  checkedInAt:  string;
  businessId?:  string;
}

export interface ServiceCompletedPayload {
  bookingId:     string;
  bookingNumber: string;
  customerName:  string;
  staffName:     string;
  completedAt:   string;
}

export interface ServiceDelayedPayload {
  bookingId:              string;
  bookingNumber:          string;
  delayMinutes:           number;
  newStartTime:           string;
  reason?:                string;
  staffName?:             string;
  businessName?:          string;
  newArrivalWindowStart?: string;
  newServiceStart?:       string;
}

export interface QueueUpdatedPayload {
  staffId:          string;
  staffName?:       string;
  businessName?:    string;
  businessId?:      string;
  queueLength?:     number;
  updatedAt?:       string;
  extraMinutes?:    number;
  delayMinutes?:    number;
  bookingsShifted?: number;
  reason?:          "service_extended" | "staff_reported_delay" | "queue_recalc";
  message?:         string;
}
export interface PaymentConfirmedPayload {
  bookingId:      string;
  bookingNumber?: string;
  amount?:        number;
  qrImageUrl:     string;
  qrExpiresAt:    string;
}

export interface PaymentReceivedPayload {
  bookingId:     string;
  bookingNumber: string;
  customerName:  string;
  amount:        number;
}

export interface PaymentFailedPayload {
  bookingId:         string;
  errorCode?:        string;
  errorDescription?: string;
  message:           string;
}

export interface EscrowReleasedPayload {
  bookingId:     string;
  bookingNumber: string;
  amount:        number;
  newBalance:    number;
  businessName:  string;
}

export interface BusinessSubmittedPayload {
  businessId:   string;
  businessName: string;
  ownerName:    string;
}

export interface BusinessApprovedPayload {
  businessId:   string;
  businessName: string;
}

export interface BusinessRejectedPayload {
  businessId:   string;
  businessName: string;
  reason?:      string;
}

export interface LeaveRequestedPayload {
  staffId:   string;
  staffName: string;
  leaveId:   string;
  startDate: string;
  endDate:   string;
}

export interface LeaveApprovedPayload {
  leaveId:   string;
  startDate: string;
  endDate:   string;
}

export interface LeaveRejectedPayload {
  leaveId:            string;
  rejection_reason?:  string;
}

export interface HolidayUpdatePayload {
  businessId: string;
  message:    string;
}

export interface NewNotificationPayload {
  type:    string;
  title:   string;
  message: string;
  data?:   Record<string, unknown>;
}