export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_DEACTIVATED: 'Your account has been deactivated. Please contact support.',
  UNAUTHORIZED: 'Authentication required',
  TOKEN_EXPIRED: 'Your session has expired. Please login again.',
  EMAIL_EXISTS: 'Email already registered',
  PHONE_EXISTS: 'Phone number already registered',
  REGISTRATION_SUCCESS: 'Registration successful',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logged out successfully',
};

export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_PHONE: 'Phone must be exactly 10 digits',
  WEAK_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, and number',
  INVALID_DATE: 'Invalid date format',
};

export const BOOKING_MESSAGES = {
  STAFF_NOT_AVAILABLE: 'Staff is not available on selected date',
  BUSINESS_CLOSED: 'Business is closed on this date',
  STAFF_ON_LEAVE: 'Staff is on leave',
  BOOKING_CREATED: 'Booking created successfully',
  BOOKING_CONFIRMED: 'Booking confirmed successfully',
  BOOKING_CANCELLED: 'Booking cancelled successfully',
  BOOKING_NOT_FOUND: 'Booking not found',
  CANNOT_CANCEL: 'This booking cannot be cancelled',
};

export const PAYMENT_MESSAGES = {
  PAYMENT_SUCCESS: 'Payment successful',
  PAYMENT_FAILED: 'Payment failed. Please try again.',
  REFUND_PROCESSED: 'Refund processed successfully',
  INVALID_SIGNATURE: 'Payment verification failed',
};

export const GENERAL_MESSAGES = {
  INTERNAL_ERROR: 'Something went wrong. Please try again later.',
  NOT_FOUND: 'Resource not found',
  FORBIDDEN: 'You do not have permission to perform this action',
};