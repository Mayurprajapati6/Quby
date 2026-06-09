export const BOOKING_STATUS = {
  PENDING_PAYMENT:    "PENDING_PAYMENT",
  CONFIRMED:          "CONFIRMED",
  CHECKED_IN:         "CHECKED_IN",
  COMPLETED:          "COMPLETED",
  CANCELLED:          "CANCELLED",
} as const;

export type BookingStatus = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];

export const TRANSACTION_STATUS = {
  PENDING:  "PENDING",
  SUCCESS:  "SUCCESS",
  FAILED:   "FAILED",
  REFUNDED: "REFUNDED",  
} as const;

export const LEAVE_STATUS = {
  PENDING:  "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const ATTENDANCE_STATUS = {
  PRESENT:   "PRESENT",
  ABSENT:    "ABSENT",
  HALF_DAY:  "HALF_DAY",
  LEAVE:     "LEAVE",
  HOLIDAY:   "HOLIDAY",
} as const;

export const ESCROW_STATUS = {
  HELD:     "HELD",
  RELEASED: "RELEASED",
  REFUNDED: "REFUNDED",
} as const;