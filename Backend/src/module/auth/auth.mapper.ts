import type { MinimalUserInfo } from "./auth.types";

export function toMinimalUser(data: {
  id:          string;
  email:       string;
  name:        string;
  role:        MinimalUserInfo["role"];
  businessId?: string;
  avatar_url?: string | null;
}): MinimalUserInfo {
  return {
    id:         data.id,
    email:      data.email,
    name:       data.name,
    role:       data.role,
    avatar_url: data.avatar_url ?? null,
  };
}
