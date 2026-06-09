export const ROLES = {
  CUSTOMER: "CUSTOMER",
  STAFF:    "STAFF",
  OWNER:    "OWNER",
  ADMIN:    "ADMIN",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
