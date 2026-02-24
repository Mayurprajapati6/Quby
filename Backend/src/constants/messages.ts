export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_DEACTIVATED: "Your account has been deactivated. Please contact support.",
  UNAUTHORIZED:        "Authentication required. Please login.",
  TOKEN_EXPIRED:       "Your session has expired. Please login again.",
  EMAIL_EXISTS:        "An account with this email already exists.",
  REGISTRATION_SUCCESS:"Account created successfully.",
  LOGIN_SUCCESS:       "Logged in successfully.",
  LOGOUT_SUCCESS:      "Logged out successfully.",
} as const;

export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: "This field is required.",
  INVALID_EMAIL:  "Invalid email format.",
  INVALID_PHONE:  "Phone must be exactly 10 digits.",
  WEAK_PASSWORD:  "Password must be at least 8 characters with uppercase, lowercase, and a number.",
} as const;

export const BOOKING_MESSAGES = {
  STAFF_NOT_AVAILABLE: "Staff is not available on the selected date.",
  BUSINESS_CLOSED:     "Business is closed on this date.",
  STAFF_ON_LEAVE:      "Staff is on leave.",
  BOOKING_CREATED:     "Booking created successfully.",
  BOOKING_CONFIRMED:   "Booking confirmed successfully.",
  BOOKING_CANCELLED:   "Booking cancelled successfully.",
  BOOKING_NOT_FOUND:   "Booking not found.",
  CANNOT_CANCEL:       "This booking cannot be cancelled.",
} as const;

export const PAYMENT_MESSAGES = {
  PAYMENT_SUCCESS:   "Payment successful.",
  PAYMENT_FAILED:    "Payment failed. Please try again.",
  REFUND_PROCESSED:  "Refund processed successfully.",
  INVALID_SIGNATURE: "Payment verification failed.",
} as const;

export const GENERAL_MESSAGES = {
  INTERNAL_ERROR: "Something went wrong. Please try again later.",
  NOT_FOUND:      "Resource not found.",
  FORBIDDEN:      "You do not have permission to perform this action.",
} as const;