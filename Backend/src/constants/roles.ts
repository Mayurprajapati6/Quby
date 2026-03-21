export const ROLES = {
  CUSTOMER: "CUSTOMER",
  STAFF:    "STAFF",
  OWNER:    "OWNER",
  BUSINESS: "BUSINESS",
  ADMIN:    "ADMIN",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];