import { MinimalUserInfo } from "./auth.types";

export const toMinimalUser = (user: {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
}): MinimalUserInfo => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});
