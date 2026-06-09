export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS:  "Invalid email or password.",
  EMAIL_NOT_FOUND:      "No account found with this email address.",
  WRONG_PASSWORD:       "Incorrect password. Please try again.",
  ACCOUNT_DEACTIVATED:  "Your account has been deactivated. Please contact support.",
  UNAUTHORIZED:         "Authentication required. Please login.",
  TOKEN_EXPIRED:        "Your session has expired. Please login again.",
  EMAIL_EXISTS:         "An account with this email already exists.",
  REGISTRATION_SUCCESS: "Account created successfully.",
  LOGIN_SUCCESS:        "Logged in successfully.",
  LOGOUT_SUCCESS:       "Logged out successfully.",
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

export const BUSINESS_MESSAGES = {
  NOT_FOUND:              "Business not found.",
  ALREADY_VERIFIED:       "This business is already verified.",
  NOT_OWNER:              "You do not own this business.",
  SLUG_TAKEN:             "A business with this name and city already exists.",
  IMAGE_LIMIT:            "A business can have a maximum of 10 images.",
  IMAGE_MIN:              "At least 3 images are required.",
  CREATED:                "Business created successfully.",
  UPDATED:                "Business details updated successfully.",
  SUBMITTED:              "Business submitted for verification.",
  APPROVED:               "Business approved successfully.",
  REJECTED:               "Business rejected.",
  SERVICE_ALREADY_EXISTS: "This service is already added to your business.",
  SERVICE_NOT_FOUND:      "Business service not found.",
  SERVICE_ADDED:          "Service added successfully.",
  SERVICE_UPDATED:        "Service updated successfully.",
  SERVICE_REMOVED:        "Service removed successfully.",
  PLATFORM_SERVICE_NOT_FOUND: "Platform service not found or inactive.",
} as const;

export const SCHEDULE_MESSAGES = {
  UPDATED:                   "Schedule updated successfully.",
  HOLIDAY_CREATED:           "Holiday created successfully.",
  HOLIDAY_UPDATED:           "Holiday updated successfully.",
  HOLIDAY_DELETED:           "Holiday deleted successfully.",
  HOLIDAY_NOT_FOUND:         "Holiday not found.",
  HOLIDAY_CONFLICT_BOOKINGS: "Cannot create holiday — confirmed bookings exist on these dates.",
  INVALID_DATE_RANGE:        "End date must be on or after start date.",
} as const;

export const STAFF_MESSAGES = {
  NOT_FOUND:              "Staff member not found.",
  EMAIL_EXISTS:           "A staff member with this email already exists in your business.",
  CREATED:                "Staff member created successfully.",
  UPDATED:                "Staff member updated successfully.",
  DEACTIVATED:            "Staff member deactivated successfully.",
  HAS_FUTURE_BOOKINGS:    "Cannot deactivate — staff has upcoming confirmed bookings.",
  LEAVE_REQUESTED:        "Leave request submitted.",
  LEAVE_APPROVED:         "Leave request approved.",
  LEAVE_REJECTED:         "Leave request rejected.",
  LEAVE_NOT_FOUND:        "Leave request not found.",
  LEAVE_NOT_PENDING:      "This leave request has already been processed.",
  LEAVE_CONFLICT_BOOKINGS:"Cannot approve leave — confirmed bookings exist on these dates.",
  SERVICE_UPDATED:        "Staff services updated successfully.",
  SCHEDULE_UPDATED:       "Staff schedule updated successfully.",
  INVITATION_SENT:        "Invitation email sent to staff member.",
} as const;

export const PLATFORM_SERVICE_MESSAGES = {
  NOT_FOUND: "Platform service not found.",
  CREATED:   "Platform service created successfully.",
  UPDATED:   "Platform service updated successfully.",
  DELETED:   "Platform service deleted successfully.",
  IN_USE:    "Cannot delete — this service is used by one or more businesses.",
} as const;