export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  STAFF:    'STAFF',
  OWNER:    'OWNER',
  ADMIN:    'ADMIN',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const isValidRole = (role: string): role is Role => {
  return Object.values(ROLES).includes(role as Role);
};